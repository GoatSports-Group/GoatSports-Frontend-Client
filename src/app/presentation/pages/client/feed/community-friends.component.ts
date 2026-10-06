import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { SOCIAL_FEED_REPOSITORY_TOKEN } from '@application/ports/persistence/social-feed.repository';
import { FollowSuggestion } from '@application/dto/social-feed/social-feed.dto';
import { LIST_CHUNK } from '@shared/directives/infinite-scroll.directive';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, catchError, debounceTime, distinctUntilChanged, finalize, map, of, switchMap, tap } from 'rxjs';
import { Friendship, UserBlock } from '@application/dto/friend/friend.dto';
import { PlayerSummary } from '@application/dto/user/user.dto';
import { CHAT_REPOSITORY_TOKEN } from '@application/ports/persistence/chat.repository';
import { FRIEND_REPOSITORY_TOKEN } from '@application/ports/persistence/friend.repository';
import { SearchPlayersUseCase } from '@application/usecase/user/search-players.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { CommunityStore } from './community.store';
import { errorMessage } from './community-view';

export type FriendList = 'friends' | 'suggestions' | 'received' | 'sent' | 'blocked';
type Confirm = { kind: 'unfriend' | 'block'; friendship: Friendship } | { kind: 'recall'; friendship: Friendship };

const LISTS: ReadonlyArray<{ value: FriendList; label: string }> = [
  { value: 'friends', label: 'Bạn bè' },
  { value: 'suggestions', label: 'Gợi ý' },
  { value: 'received', label: 'Lời mời' },
  { value: 'sent', label: 'Đã gửi' },
  { value: 'blocked', label: 'Đã chặn' }
];

/** Goi y ket ban moi lan tai them. */
const SUGGESTION_PAGE = 20;

/** Tab "Bạn bè" trong Cộng đồng: tìm người chơi, lời mời, danh sách bạn và danh sách chặn. */
@Component({
  selector: 'app-community-friends',
  templateUrl: './community-friends.component.html',
  styleUrls: ['./community-friends.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class CommunityFriendsComponent implements OnInit {
  private readonly friendRepository = inject(FRIEND_REPOSITORY_TOKEN);
  private readonly feedRepository = inject(SOCIAL_FEED_REPOSITORY_TOKEN);
  private readonly chatRepository = inject(CHAT_REPOSITORY_TOKEN);
  private readonly searchPlayers = inject(SearchPlayersUseCase);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(CommunityStore);

  readonly lists = LISTS;
  readonly list = signal<FriendList>('friends');
  /** Ban be tra ve ca mang (chi ID); chi render dan tung LIST_CHUNK dong khi cuon. */
  readonly shown = signal(LIST_CHUNK);
  readonly pending = signal<ReadonlySet<string>>(new Set());
  readonly confirm = signal<Confirm | null>(null);

  /** Muc "Goi y": ai nen ket ban (da ghep tran, cung CLB, ban chung...), cuon vo han tung trang 20. */
  readonly suggestions = signal<FollowSuggestion[]>([]);
  readonly suggestLoading = signal(false);
  readonly suggestError = signal(false);
  readonly suggestHasMore = signal(true);

  readonly query = signal('');
  readonly results = signal<PlayerSummary[] | null>(null);
  readonly searching = signal(false);
  readonly searchError = signal(false);
  private readonly search$ = new Subject<string>();

  readonly counts = computed(() => {
    const connections = this.store.connections();
    return {
      friends: connections.friends.length,
      received: connections.received.length,
      sent: connections.sent.length,
      blocked: connections.blocked.length
    } satisfies Record<Exclude<FriendList, 'suggestions'>, number>;
  });

  ngOnInit(): void {
    this.store.loadConnections();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const list = params.get('list') as FriendList | null;
      this.list.set(LISTS.some(item => item.value === list) ? list! : 'friends');
      this.shown.set(LIST_CHUNK);
      if (this.list() === 'suggestions' && !this.suggestions().length) this.loadSuggestions();
    });
    this.search$.pipe(
      map(value => value.trim()),
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => this.searchError.set(false)),
      switchMap(value => this.runSearch(value)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(results => this.results.set(results));
  }

  loadSuggestions(): void {
    if (this.suggestLoading()) return;
    this.suggestLoading.set(true);
    this.suggestError.set(false);
    this.feedRepository.getFollowSuggestions(SUGGESTION_PAGE, [], this.suggestions().length).pipe(
      finalize(() => this.suggestLoading.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: page => {
        const seen = new Set(this.suggestions().map(item => item.authorId));
        this.suggestions.update(current => [...current, ...page.filter(item => !seen.has(item.authorId))]);
        this.suggestHasMore.set(page.length === SUGGESTION_PAGE);
        this.store.hydrateAuthors(page.map(item => item.authorId));
      },
      error: () => this.suggestError.set(true)
    });
  }

  selectList(list: FriendList): void {
    this.confirm.set(null);
    void this.router.navigate([], { queryParams: { list: list === 'friends' ? null : list }, queryParamsHandling: 'merge' });
  }

  showMore(): void {
    this.shown.update(count => count + LIST_CHUNK);
  }

  onQuery(value: string): void {
    this.query.set(value);
    this.search$.next(value);
  }

  clearSearch(): void {
    this.onQuery('');
  }

  // ---- actions --------------------------------------------------------------------------------

  sendRequest(player: PlayerSummary): void {
    this.act(player.userId, this.friendRepository.sendFriendRequest({ targetUserId: player.userId }),
      `Đã gửi lời mời kết bạn tới ${player.fullName}.`, 'Không thể gửi lời mời kết bạn.');
  }

  respond(friendship: Friendship, accepted: boolean): void {
    this.act(friendship.friendshipId, this.friendRepository.respondFriendRequest(friendship.friendshipId, { accepted }),
      accepted ? `Bạn và ${this.store.authorName(friendship.requesterId)} đã là bạn bè.` : 'Đã từ chối lời mời.',
      'Không thể phản hồi lời mời.');
  }

  unblock(block: UserBlock): void {
    this.act(block.blockId, this.friendRepository.unblockUser(block.blockId),
      `Đã bỏ chặn ${this.store.authorName(block.blockedUserId)}.`, 'Không thể bỏ chặn.');
  }

  confirmAction(): void {
    const pending = this.confirm();
    if (!pending) return;
    const friendship = pending.friendship;
    const other = this.store.otherParty(friendship);
    const name = this.store.authorName(other);
    const request$: Observable<unknown> = pending.kind === 'block'
      ? this.friendRepository.blockUser({ blockedUserId: other, reason: 'Chặn từ danh sách bạn bè' })
      : this.friendRepository.unfriend(friendship.friendshipId);
    const done = pending.kind === 'block' ? `Đã chặn ${name}.` : pending.kind === 'recall' ? 'Đã thu hồi lời mời.' : `Đã hủy kết bạn với ${name}.`;
    this.act(friendship.friendshipId, request$, done, 'Không thực hiện được thao tác.');
    this.confirm.set(null);
  }

  message(friendship: Friendship): void {
    const key = `chat-${friendship.friendshipId}`;
    this.mark(key, true);
    this.chatRepository.getOrCreateDirectRoom({ targetUserId: this.store.otherParty(friendship) }).pipe(
      finalize(() => this.mark(key, false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: response => { if (response.data) void this.router.navigate(['/chat', response.data.roomId]); },
      error: error => this.notify.error(errorMessage(error, 'Không mở được cuộc trò chuyện.'))
    });
  }

  isPending(id: string): boolean {
    return this.pending().has(id);
  }

  /** Moi thao tac xong deu tai lai danh sach: thu tu, so dem va huy hieu tab luon khop voi server. */
  private act(id: string, request$: Observable<unknown>, success: string, failure: string): void {
    if (this.isPending(id)) return;
    this.mark(id, true);
    request$.pipe(finalize(() => this.mark(id, false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notify.success(success);
        this.store.loadConnections();
      },
      error: error => this.notify.error(errorMessage(error, failure))
    });
  }

  private runSearch(value: string): Observable<PlayerSummary[] | null> {
    if (value.length < 2) return of(null);
    this.searching.set(true);
    return this.searchPlayers.execute(value).pipe(
      catchError(() => {
        this.searchError.set(true);
        return of([]);
      }),
      finalize(() => this.searching.set(false))
    );
  }

  private mark(id: string, active: boolean): void {
    this.pending.update(ids => {
      const next = new Set(ids);
      if (active) next.add(id); else next.delete(id);
      return next;
    });
  }
}
