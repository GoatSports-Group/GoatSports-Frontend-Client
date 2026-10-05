import { PAGE_SIZE } from '@shared/constants/page-size';
import { PostDialogService } from './post-dialog.service';
import { foldText } from './rich-text';
import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, computed, inject, signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, catchError, finalize, forkJoin, map, of, timeout } from 'rxjs';
import { SpringPageResponse } from '@application/dto/base/base-response';
import {
  FollowSuggestion, PostSport, SocialPost, TrendingTag, UserFollowStatus
} from '@application/dto/social-feed/social-feed.dto';
import { PlayerSportProfile } from '@application/dto/player-sport-profile/player-sport-profile.dto';
import { SOCIAL_FEED_REPOSITORY_TOKEN } from '@application/ports/persistence/social-feed.repository';
import { PLAYER_SPORT_PROFILE_REPOSITORY_TOKEN } from '@application/ports/persistence/player-sport-profile.repository';
import { playFormatLabel } from '@application/dto/matchmaking/matchmaking.dto';
import { AuthService } from '@presentation/services/auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { skillLabel } from '@presentation/pages/client/clubs/scouting-view.model';
import { CommunityStore } from './community.store';
import { FEED_TABS, FeedTab, POST_SPORTS, compactCount, errorMessage, sportLabel } from './community-view';
import { PlayerCallPrefill } from './post-composer.component';

const FEED_PAGE = PAGE_SIZE.stream;
/** So keo trong cac the "Keo cua toi" / "Keo hop voi ban". */
const CALL_PREVIEW = 3;

interface ProfileStats {
  postCount: number;
  followerCount: number;
  followingCount: number;
}

/** Trang thai tai cua mot khoi du lieu tren trang (GOAT-DESIGN §6: loading → error → empty/content). */
interface Section<T> {
  loading: boolean;
  error: boolean;
  data: T;
}

/** Mon cua nguoi xem (tu ho so the thao), da loc ve cac mon bang tin ho tro. */
interface MySport {
  sport: PostSport;
  level: string;
}

/**
 * Thanh tab: "Bai cua toi" la trang ca nhan (bam the ho so). "Tim nguoi choi" khong la tab: keo nam trong Kham pha,
 * danh sach keo con mo mo tu "Keo hop voi ban › Xem tat ca" (`?tab=calls`, hien banner).
 */
const BAR_TABS = FEED_TABS.filter(item => item.value !== 'mine' && item.value !== 'calls');

@Component({
  selector: 'app-social-feed',
  templateUrl: './social-feed.component.html',
  styleUrls: ['./social-feed.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class SocialFeedComponent implements OnInit, OnDestroy {
  private readonly repository = inject(SOCIAL_FEED_REPOSITORY_TOKEN);
  private readonly profiles = inject(PLAYER_SPORT_PROFILE_REPOSITORY_TOKEN);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly postDialog = inject(PostDialogService);
  readonly auth = inject(AuthService);
  readonly store = inject(CommunityStore);

  readonly tabs = BAR_TABS;
  readonly sportLabel = sportLabel;
  readonly compactCount = compactCount;

  readonly tab = signal<FeedTab>('explore');
  /** Mot mon cu the; null = khong loc mot mon (xem {@link mineOnly}). */
  readonly sport = signal<PostSport | null>(null);
  /** Loc "Mon cua ban" (moi mon trong ho so the thao). */
  readonly mineOnly = signal(false);
  readonly authorId = signal<string | null>(null);
  readonly tag = signal<string | null>(null);
  /** Tu trang ghep tran ("Chua co ban cap? Dang tim nguoi choi"): mo o soan o che do keo, dien san mon/hinh thuc. */
  readonly callPrefill = signal<PlayerCallPrefill | null>(null);
  /** O soan thu gon thanh mot dong; mo ra khi bam, dong lai sau khi dang. */
  readonly composerKind = signal<'CALL' | 'POST' | null>(null);

  readonly posts = signal<SocialPost[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly loadingMore = signal(false);
  readonly moreError = signal(false);
  readonly hasMore = signal(false);
  private page = 1;
  private trendingRequest?: Subscription;
  /** Bo loc mon cua lan tai chu de gan nhat. */
  private trendingKey: string | null = null;
  /** Bo loc cua lan tai gan nhat (tab, mon, tac gia, chu de). */
  private feedKey = '';
  private request?: Subscription;

  readonly mySports = signal<Section<MySport[]>>({ loading: true, error: false, data: [] });
  readonly authorStats = signal<Section<ProfileStats | null>>({ loading: true, error: false, data: null });
  readonly myCalls = signal<Section<SocialPost[]>>({ loading: true, error: false, data: [] });
  readonly matchingCalls = signal<Section<SocialPost[]>>({ loading: true, error: false, data: [] });
  readonly suggestions = signal<Section<FollowSuggestion[]>>({ loading: true, error: false, data: [] });
  readonly trending = signal<Section<TrendingTag[]>>({ loading: true, error: false, data: [] });
  /** Duoi 1024px hai cot ben an; khoi kham pha chen vao giua bang tin sau bai thu 3. */
  readonly discoveryAfter = 3;

  readonly mySportSet = computed(() => new Set(this.mySports().data.map(item => item.sport)));
  /** Chip mon: mon cua toi dung truoc. */
  readonly sportChips = computed(() => [
    ...POST_SPORTS.filter(item => this.mySportSet().has(item)),
    ...POST_SPORTS.filter(item => !this.mySportSet().has(item))
  ]);
  /** Mon mac dinh khi soan: mon dang loc, khong thi mon dau tien trong ho so. */
  readonly composerSport = computed(() => this.sport() ?? this.mySports().data[0]?.sport ?? null);

  readonly isAuthorView = computed(() => !!this.authorId());
  readonly isMyAuthorView = computed(() => this.authorId() === this.me);
  readonly isFriendsTab = computed(() => this.tab() === 'friends' && !this.isAuthorView());
  readonly isCallsView = computed(() => this.tab() === 'calls' && !this.isAuthorView());
  readonly showComposer = computed(() =>
    this.tab() !== 'saved' && !this.isFriendsTab() && (!this.isAuthorView() || this.isMyAuthorView()));
  readonly showSportFilter = computed(() => this.tab() !== 'saved' && !this.isFriendsTab());
  readonly pendingRequests = computed(() => this.store.connections().received.length);

  /** Khung cuon cua cot giua (>= 1024px); doi bo loc thi dua ve dau. */
  @ViewChild('scroller') private scroller?: ElementRef<HTMLElement>;
  /** Popup "Nguoi theo doi / Dang theo doi" cua trang ca nhan dang xem. */
  readonly followList = signal<{ userId: string; tab: 'followers' | 'following' } | null>(null);

  get me(): string | null {
    return this.auth.currentUser?.userId ?? null;
  }

  ngOnInit(): void {
    this.store.loadFollowing(this.me);
    this.store.loadConnections();
    this.loadMyCalls();
    // Thich, binh luan, sua, xoa trong popup bai viet: cap nhat the tuong ung tren bang tin.
    this.postDialog.changes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(post => {
      if (this.posts().some(item => item.postId === post.postId)) this.onChanged(post);
    });
    this.postDialog.published.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(post => this.onPublished(post));
    this.postDialog.removals.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(postId => this.onRemoved(postId));

    // Bo loc mac dinh can biet mon cua nguoi xem, nen doc ho so the thao truoc roi moi theo doi URL.
    // Ho so cham / loi thi van mo bang tin (khong ca nhan hoa) thay vi de trang trong.
    this.profiles.getMyProfiles().pipe(timeout({ first: 5000 }), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: profiles => this.startFeed(profiles, false),
      error: () => this.startFeed([], true)
    });
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
  }

  private startFeed(profiles: PlayerSportProfile[] | null, failed: boolean): void {
    const sports = (Array.isArray(profiles) ? profiles : [])
      .filter(item => POST_SPORTS.includes(item.sportType as PostSport))
      .map(item => ({ sport: item.sportType as PostSport, level: skillLabel(item.skillLevel as unknown as Parameters<typeof skillLabel>[0]) }));
    this.mySports.set({ loading: false, error: failed, data: sports });
    this.loadSuggestions();
    this.loadMatchingCalls();

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const tab = params.get('tab') as FeedTab | null;
      // "Bai cua toi" cu (link cu, thong bao) → trang ca nhan cua toi.
      if (tab === 'mine' && this.me) {
        void this.router.navigate([], { queryParams: { tab: null, author: this.me }, queryParamsHandling: 'merge', replaceUrl: true });
        return;
      }
      const sport = params.get('sport');
      this.tab.set(FEED_TABS.some(item => item.value === tab) ? tab! : 'explore');
      this.authorId.set(params.get('author'));
      this.tag.set(params.get('tag')?.replace(/^#/, '').toLowerCase() || null);
      this.sport.set(sport && POST_SPORTS.includes(sport as PostSport) ? sport as PostSport : null);
      this.mineOnly.set(this.mySportSet().size > 0 && (sport === 'mine' || (!sport && this.defaultsToMine())));
      // Link bai viet (/feed?post=:id, link cu /feed/posts/:id cung ve day): mo popup tren bang tin.
      const postId = params.get('post');
      if (postId && this.postDialog.current()?.postId !== postId) this.postDialog.open(postId);
      if (params.get('compose') === 'find-players') {
        this.callPrefill.set({ sport: this.sport(), format: params.get('format') });
        this.composerKind.set('CALL');
      }
      // Chi tai lai khi bo loc doi; bo `?compose=` sau khi dang khong duoc xoa bai vua chen vao dau danh sach.
      const key = [this.tab(), this.sport(), this.mineOnly(), this.authorId(), this.tag()].join('|');
      const trendingKey = `${this.sport()}|${this.mineOnly()}`;
      if (trendingKey !== this.trendingKey) {
        this.trendingKey = trendingKey;
        this.loadTrending();
      }
      if (key === this.feedKey) return;
      this.feedKey = key;
      this.followList.set(null);
      if (this.scroller) this.scroller.nativeElement.scrollTop = 0;
      if (!this.isFriendsTab()) this.reload();
      if (this.authorId()) this.loadAuthorStats(this.authorId()!);
    });
  }

  /** Ca nhan hoa: Tim nguoi choi va Kham pha mo san o "Mon cua ban"; Dang theo doi giu het vi da tu chon nguoi. */
  private defaultsToMine(): boolean {
    return !this.authorId() && !this.tag() && (this.tab() === 'calls' || this.tab() === 'explore');
  }

  // ---- navigation (state lives in the URL so back/forward and shared links work) --------------

  selectTab(tab: FeedTab): void {
    void this.router.navigate([], {
      queryParams: { tab: tab === 'explore' ? null : tab, author: null, list: null },
      queryParamsHandling: 'merge'
    });
  }

  /** Chip chu de dang loc (so khop khong dau). */
  isActiveTag(tag: string): boolean {
    return !!this.tag() && foldText(this.tag()!) === foldText(tag);
  }

  /**
   * Lan chuot o khoang trong hai ben, tren thanh tab / chip, hoac tren cot ben da het cho cuon: cuon bang tin,
   * vi tren desktop chi cot giua cuon.
   */
  @HostListener('wheel', ['$event'])
  forwardWheel(event: WheelEvent): void {
    const scroller = this.scroller?.nativeElement;
    const target = event.target as HTMLElement | null;
    if (!scroller || getComputedStyle(scroller).overflowY !== 'auto') return;
    if (target?.closest('.feed__scroll, .modal-backdrop')) return;
    // Cot ben con cuon duoc theo huong nay thi de no tu cuon; het cho (hoac ngan) thi cuon bang tin.
    const rail = target?.closest<HTMLElement>('.rail');
    if (rail && (event.deltaY > 0 ? rail.scrollTop + rail.clientHeight < rail.scrollHeight - 1 : rail.scrollTop > 0)) return;
    scroller.scrollBy({ top: event.deltaY });
  }

  /** Kèo / bai o cot ben: mo popup bai viet, khong roi trang. */
  openPost(event: Event, post: SocialPost): void {
    event.preventDefault();
    this.postDialog.open(post);
  }

  /** "Xem tat ca" goi y theo doi: tab Ban be, muc Goi y (cuon vo han). */
  showAllSuggestions(): void {
    void this.router.navigate([], { queryParams: { tab: 'friends', list: 'suggestions', author: null, tag: null } , queryParamsHandling: 'merge' });
  }

  clearTag(): void {
    void this.router.navigate([], { queryParams: { tag: null }, queryParamsHandling: 'merge' });
  }

  /** 'mine' = Mon cua ban, null = Tat ca mon, hoac mot mon. Ghi ro ra URL vi mac dinh co the la 'mine'. */
  selectSport(sport: PostSport | 'mine' | null): void {
    void this.router.navigate([], { queryParams: { sport: sport ?? 'all' }, queryParamsHandling: 'merge' });
  }

  clearAuthor(): void {
    void this.router.navigate([], { queryParams: { author: null }, queryParamsHandling: 'merge' });
  }

  /** "Tao keo" tu the Keo cua toi: mo hop thoai soan keo ngay tai cho. */
  composeCall(): void {
    this.composerKind.set('CALL');
  }

  /** Dong hop thoai soan; bo luon thong tin dien san tu trang ghep tran de lan mo sau khong bi dien lai. */
  closeComposer(): void {
    this.composerKind.set(null);
    this.callPrefill.set(null);
    if (this.route.snapshot.queryParamMap.has('compose')) {
      void this.router.navigate([], { queryParams: { compose: null, format: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  // ---- feed -----------------------------------------------------------------------------------

  reload(): void {
    this.request?.unsubscribe();
    this.page = 1;
    this.loading.set(true);
    this.loadError.set(false);
    this.moreError.set(false);
    this.request = this.fetch(1).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: response => {
        this.posts.set(response.content);
        this.hasMore.set(!response.last);
        this.store.hydrate(response.content);
      },
      error: () => {
        this.posts.set([]);
        this.loadError.set(true);
      }
    });
  }

  loadMore(): void {
    if (!this.hasMore() || this.loading() || this.loadingMore() || this.moreError()) return;
    this.loadingMore.set(true);
    this.request = this.fetch(this.page + 1).pipe(finalize(() => this.loadingMore.set(false))).subscribe({
      next: response => {
        this.page += 1;
        // Bai moi dang trong luc cuon co the day mot bai sang trang sau; bo trung theo id.
        const seen = new Set(this.posts().map(post => post.postId));
        this.posts.update(current => [...current, ...response.content.filter(post => !seen.has(post.postId))]);
        this.hasMore.set(!response.last);
        this.store.hydrate(response.content);
      },
      error: () => this.moreError.set(true)
    });
  }

  retryMore(): void {
    this.moreError.set(false);
    this.loadMore();
  }

  private fetch(page: number): Observable<SpringPageResponse<SocialPost>> {
    if (this.tab() === 'saved' && !this.authorId()) return this.repository.getSavedPosts(page, FEED_PAGE);
    const authorId = this.authorId();
    return this.repository.getFeed(page, FEED_PAGE, {
      followingOnly: !authorId && this.tab() === 'following',
      playerCallsOnly: !authorId && this.tab() === 'calls',
      sport: this.sport(),
      sports: this.mineOnly() ? [...this.mySportSet()] : null,
      tag: this.tag(),
      authorId
    });
  }

  // ---- card events ----------------------------------------------------------------------------

  onPublished(post: SocialPost): void {
    this.closeComposer();
    if (this.fits(post)) this.posts.update(items => [post, ...items]);
    if (post.playerCall) this.loadMyCalls();
    this.bumpMyPosts(1);
  }

  onChanged(post: SocialPost): void {
    if (this.tab() === 'saved' && !this.authorId() && !post.savedByCurrentUser) {
      this.posts.update(items => items.filter(item => item.postId !== post.postId));
      return;
    }
    // Keo vua danh dau du nguoi van o yen tai cho (de "Mo lai keo" ngay); lan tai sau tab Tim nguoi choi moi bo no.
    this.posts.update(items => items.map(item => item.postId === post.postId ? post : item));
    if (post.playerCall && post.authorId === this.me) this.loadMyCalls();
  }

  onRemoved(postId: string): void {
    this.posts.update(items => items.filter(item => item.postId !== postId));
    this.myCalls.update(section => ({ ...section, data: section.data.filter(item => item.postId !== postId) }));
    this.bumpMyPosts(-1);
  }

  onAuthorBlocked(authorId: string): void {
    this.posts.update(items => items.filter(item => item.authorId !== authorId && item.sharedPost?.authorId !== authorId));
    this.suggestions.update(section => ({ ...section, data: section.data.filter(item => item.authorId !== authorId) }));
    this.matchingCalls.update(section => ({ ...section, data: section.data.filter(item => item.authorId !== authorId) }));
    if (this.authorId() === authorId) this.clearAuthor();
  }

  // ---- rails ----------------------------------------------------------------------------------

  /** "Cau long · Doi" cho mot dong keo trong cot ben. */
  callTitle(post: SocialPost): string {
    const call = post.playerCall!;
    const format = playFormatLabel(call.playFormat);
    return format ? `${sportLabel(call.sport)} · ${format}` : sportLabel(call.sport);
  }

  /** Ngay choi yyyy-MM-dd → Date dia phuong cho pipe date (khong lech mui gio). */
  callDate(post: SocialPost): Date {
    const [year, month, day] = post.playerCall!.playDate.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  followSuggestion(authorId: string): void {
    this.store.toggleFollow(authorId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: status => {
        this.notify.success(status.followed ? `Đang theo dõi ${this.store.authorName(authorId)}.` : 'Đã bỏ theo dõi.');
        this.adjustFollowing(status.followed ? 1 : -1);
      },
      error: error => this.notify.error(errorMessage(error, 'Không thể cập nhật theo dõi.'))
    });
  }

  toggleAuthorFollow(): void {
    const authorId = this.authorId();
    if (!authorId) return;
    this.store.toggleFollow(authorId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: status => {
        this.authorStats.update(section => section.data
          ? { ...section, data: { ...section.data, followerCount: status.followerCount } }
          : section);
        this.adjustFollowing(status.followed ? 1 : -1);
      },
      error: error => this.notify.error(errorMessage(error, 'Không thể cập nhật theo dõi.'))
    });
  }

  loadSuggestions(): void {
    this.suggestions.set({ loading: true, error: false, data: [] });
    this.repository.getFollowSuggestions(5, [...this.mySportSet()]).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.suggestions.set({ loading: false, error: false, data });
        this.store.hydrateAuthors(data.map(item => item.authorId));
      },
      error: () => this.suggestions.set({ loading: false, error: true, data: [] })
    });
  }

  loadTrending(): void {
    this.trending.set({ loading: true, error: false, data: [] });
    // Chu de theo bo loc mon dang xem: mot mon, "Mon cua ban", hoac tat ca.
    const sports = this.sport() ? [this.sport()!] : this.mineOnly() ? [...this.mySportSet()] : [];
    this.trendingRequest?.unsubscribe();
    this.trendingRequest = this.repository.getTrendingTags(8, sports).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => this.trending.set({ loading: false, error: false, data }),
      error: () => this.trending.set({ loading: false, error: true, data: [] })
    });
  }

  /** Keo con mo cua chinh toi, sap dien ra truoc. */
  loadMyCalls(): void {
    const me = this.me;
    if (!me) return;
    this.myCalls.update(section => ({ ...section, loading: true, error: false }));
    this.repository.getFeed(1, CALL_PREVIEW, { authorId: me, playerCallsOnly: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => this.myCalls.set({ loading: false, error: false, data: page.content.filter(post => !!post.playerCall) }),
        error: () => this.myCalls.set({ loading: false, error: true, data: [] })
      });
  }

  /** Keo con mo cua nguoi khac o mon cua toi (khong co mon thi moi mon), sap dien ra truoc. */
  loadMatchingCalls(): void {
    this.matchingCalls.set({ loading: true, error: false, data: [] });
    const sports = [...this.mySportSet()];
    // Lay du hon mot keo phong khi keo cua chinh toi nam trong trang dau.
    this.repository.getFeed(1, CALL_PREVIEW + 2, { playerCallsOnly: true, sports })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => {
          const others = page.content.filter(post => post.playerCall && post.authorId !== this.me).slice(0, CALL_PREVIEW);
          this.matchingCalls.set({ loading: false, error: false, data: others });
          this.store.hydrate(others);
        },
        error: () => this.matchingCalls.set({ loading: false, error: true, data: [] })
      });
  }

  loadAuthorStats(authorId: string): void {
    this.store.hydrateAuthors([authorId]);
    this.authorStats.set({ loading: true, error: false, data: null });
    this.profileStats(authorId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => this.authorStats.set({ loading: false, error: false, data }),
      error: () => this.authorStats.set({ loading: false, error: true, data: null })
    });
  }

  private profileStats(userId: string): Observable<ProfileStats> {
    return forkJoin({
      stats: this.repository.getAuthorStats(userId),
      follow: this.repository.getFollowStatus(userId).pipe(
        catchError(() => of<UserFollowStatus>({ userId, followed: false, followerCount: 0, followingCount: 0 })))
    }).pipe(map(({ stats, follow }) => ({
      postCount: stats.postCount,
      followerCount: follow.followerCount,
      followingCount: follow.followingCount
    })));
  }

  private fits(post: SocialPost): boolean {
    if (this.tab() === 'saved' && !this.authorId()) return false;
    if (this.isFriendsTab()) return false;
    if (this.authorId() && this.authorId() !== post.authorId) return false;
    // Chu de so khop khong dau, nhu server ("#bóngđá" = "#bongda").
    if (this.tag() && !post.tags?.some(tag => foldText(tag) === foldText(this.tag()!))) return false;
    if (this.tab() === 'calls' && !this.authorId() && !post.playerCall) return false;
    // Dang theo doi chi co bai cua nguoi minh theo doi, khong bao gio bai cua chinh minh.
    if (this.tab() === 'following' && !this.authorId()) return false;
    if (this.mineOnly() && (!post.sport || !this.mySportSet().has(post.sport))) return false;
    return !this.sport() || this.sport() === post.sport;
  }

  private bumpMyPosts(delta: number): void {
    const update = (section: Section<ProfileStats | null>) => section.data
      ? { ...section, data: { ...section.data, postCount: Math.max(0, section.data.postCount + delta) } }
      : section;
    if (this.isMyAuthorView()) this.authorStats.update(update);
  }

  private adjustFollowing(delta: number): void {
    if (!this.isMyAuthorView()) return;
    this.authorStats.update(section => section.data
      ? { ...section, data: { ...section.data, followingCount: Math.max(0, section.data.followingCount + delta) } }
      : section);
  }
}
