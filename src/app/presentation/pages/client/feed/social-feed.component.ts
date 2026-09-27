import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, catchError, finalize, forkJoin, map, of } from 'rxjs';
import { SpringPageResponse } from '@application/dto/base/base-response';
import { FollowSuggestion, PostSport, SocialPost, UserFollowStatus } from '@application/dto/social-feed/social-feed.dto';
import { SOCIAL_FEED_REPOSITORY_TOKEN } from '@application/ports/persistence/social-feed.repository';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import { ClubModel } from '@domain/models/club.model';
import { TournamentModel } from '@domain/models/tournament.model';
import { AuthService } from '@presentation/services/auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { DEFAULT_CLUB_LOGO } from '@presentation/pages/client/clubs/club-view.model';
import { CommunityStore } from './community.store';
import { FEED_TABS, FeedTab, POST_SPORTS, compactCount, errorMessage, sportLabel } from './community-view';

const PAGE_SIZE = 10;

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

@Component({
  selector: 'app-social-feed',
  templateUrl: './social-feed.component.html',
  styleUrls: ['./social-feed.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class SocialFeedComponent implements OnInit, OnDestroy {
  private readonly repository = inject(SOCIAL_FEED_REPOSITORY_TOKEN);
  private readonly tournaments = inject(TournamentRepositoryPort);
  private readonly clubs = inject(ClubRepositoryPort);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);
  readonly store = inject(CommunityStore);

  readonly tabs = FEED_TABS;
  readonly sports = POST_SPORTS;
  readonly sportLabel = sportLabel;
  readonly compactCount = compactCount;
  readonly defaultClubLogo = DEFAULT_CLUB_LOGO;

  readonly tab = signal<FeedTab>('explore');
  readonly sport = signal<PostSport | null>(null);
  readonly authorId = signal<string | null>(null);

  readonly posts = signal<SocialPost[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly loadingMore = signal(false);
  readonly moreError = signal(false);
  readonly hasMore = signal(false);
  private page = 1;
  private request?: Subscription;
  private observer?: IntersectionObserver;

  readonly myStats = signal<Section<ProfileStats | null>>({ loading: true, error: false, data: null });
  readonly authorStats = signal<Section<ProfileStats | null>>({ loading: true, error: false, data: null });
  readonly suggestions = signal<Section<FollowSuggestion[]>>({ loading: true, error: false, data: [] });
  readonly openTournaments = signal<Section<TournamentModel[]>>({ loading: true, error: false, data: [] });
  readonly sportClubs = signal<Section<ClubModel[]>>({ loading: true, error: false, data: [] });

  readonly isAuthorView = computed(() => !!this.authorId());
  readonly isMyAuthorView = computed(() => this.authorId() === this.me);
  /** Bai moi / bai chia se chi chen vao dau danh sach neu no thuoc bo loc dang xem. */
  readonly showComposer = computed(() =>
    this.tab() !== 'saved' && (!this.isAuthorView() || this.isMyAuthorView()));
  readonly showSportFilter = computed(() => this.tab() !== 'saved');

  @ViewChild('sentinel') set sentinel(element: ElementRef<HTMLElement> | undefined) {
    this.observer?.disconnect();
    if (!element || typeof IntersectionObserver === 'undefined') return;
    // Tai trang tiep khi con ~600px nua la het danh sach.
    this.observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) this.loadMore();
    }, { rootMargin: '600px 0px' });
    this.observer.observe(element.nativeElement);
  }

  get me(): string | null {
    return this.auth.currentUser?.userId ?? null;
  }

  ngOnInit(): void {
    this.store.loadFollowing(this.me);
    this.loadMyStats();
    this.loadSuggestions();

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const tab = params.get('tab') as FeedTab | null;
      const sport = params.get('sport') as PostSport | null;
      this.tab.set(FEED_TABS.some(item => item.value === tab) ? tab! : 'explore');
      this.sport.set(sport && POST_SPORTS.includes(sport) ? sport : null);
      this.authorId.set(params.get('author'));
      this.reload();
      this.loadRails();
      if (this.authorId()) this.loadAuthorStats(this.authorId()!);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.request?.unsubscribe();
  }

  // ---- navigation (state lives in the URL so back/forward and shared links work) --------------

  selectTab(tab: FeedTab): void {
    void this.router.navigate([], { queryParams: { tab: tab === 'explore' ? null : tab, author: null }, queryParamsHandling: 'merge' });
  }

  selectSport(sport: PostSport | null): void {
    void this.router.navigate([], { queryParams: { sport }, queryParamsHandling: 'merge' });
  }

  clearAuthor(): void {
    void this.router.navigate([], { queryParams: { author: null }, queryParamsHandling: 'merge' });
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
    if (this.tab() === 'saved' && !this.authorId()) return this.repository.getSavedPosts(page, PAGE_SIZE);
    const authorId = this.authorId() ?? (this.tab() === 'mine' ? this.me : null);
    return this.repository.getFeed(page, PAGE_SIZE, {
      followingOnly: !authorId && this.tab() === 'following',
      sport: this.sport(),
      authorId
    });
  }

  // ---- card events ----------------------------------------------------------------------------

  onPublished(post: SocialPost): void {
    if (this.fits(post)) this.posts.update(items => [post, ...items]);
    this.bumpMyPosts(1);
  }

  onChanged(post: SocialPost): void {
    if (this.tab() === 'saved' && !this.authorId() && !post.savedByCurrentUser) {
      this.posts.update(items => items.filter(item => item.postId !== post.postId));
      return;
    }
    this.posts.update(items => items.map(item => item.postId === post.postId ? post : item));
  }

  onRemoved(postId: string): void {
    this.posts.update(items => items.filter(item => item.postId !== postId));
    this.bumpMyPosts(-1);
  }

  onAuthorBlocked(authorId: string): void {
    this.posts.update(items => items.filter(item => item.authorId !== authorId && item.sharedPost?.authorId !== authorId));
    this.suggestions.update(section => ({ ...section, data: section.data.filter(item => item.authorId !== authorId) }));
    if (this.authorId() === authorId) this.clearAuthor();
  }

  // ---- rails ----------------------------------------------------------------------------------

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
    this.repository.getFollowSuggestions(5).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.suggestions.set({ loading: false, error: false, data });
        this.store.hydrateAuthors(data.map(item => item.authorId));
      },
      error: () => this.suggestions.set({ loading: false, error: true, data: [] })
    });
  }

  loadRails(): void {
    const sport = this.sport() ?? undefined;
    this.openTournaments.set({ loading: true, error: false, data: [] });
    this.tournaments.searchTournaments({ status: 'REGISTRATION_OPEN', sportType: sport, sort: 'registrationCloseDate,asc' }, 0, 3)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => this.openTournaments.set({ loading: false, error: false, data: page.items }),
        error: () => this.openTournaments.set({ loading: false, error: true, data: [] })
      });

    this.sportClubs.set({ loading: true, error: false, data: [] });
    this.clubs.searchClubs(sport).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: clubs => this.sportClubs.set({
        loading: false,
        error: false,
        data: [...clubs].sort((a, b) => b.memberCount - a.memberCount).slice(0, 3)
      }),
      error: () => this.sportClubs.set({ loading: false, error: true, data: [] })
    });
  }

  loadMyStats(): void {
    const me = this.me;
    if (!me) return;
    this.myStats.set({ loading: true, error: false, data: null });
    this.profileStats(me).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => this.myStats.set({ loading: false, error: false, data }),
      error: () => this.myStats.set({ loading: false, error: true, data: null })
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

  useLogoFallback(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(this.defaultClubLogo)) image.src = this.defaultClubLogo;
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
    if (this.authorId() && this.authorId() !== post.authorId) return false;
    return !this.sport() || this.sport() === post.sport;
  }

  private bumpMyPosts(delta: number): void {
    const update = (section: Section<ProfileStats | null>) => section.data
      ? { ...section, data: { ...section.data, postCount: Math.max(0, section.data.postCount + delta) } }
      : section;
    this.myStats.update(update);
    if (this.isMyAuthorView()) this.authorStats.update(update);
  }

  private adjustFollowing(delta: number): void {
    this.myStats.update(section => section.data
      ? { ...section, data: { ...section.data, followingCount: Math.max(0, section.data.followingCount + delta) } }
      : section);
  }
}
