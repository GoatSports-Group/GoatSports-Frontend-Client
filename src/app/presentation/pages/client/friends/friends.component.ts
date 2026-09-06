import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, forkJoin, map, switchMap } from 'rxjs';
import { FRIEND_REPOSITORY_TOKEN } from '@application/ports/persistence/friend.repository';
import { CHAT_REPOSITORY_TOKEN } from '@application/ports/persistence/chat.repository';
import { CURRENT_USER_PROVIDER_TOKEN } from '@application/ports/current-user.provider';
import { Friendship, UserBlock } from '@application/dto/friend/friend.dto';
import { PlayerSummary } from '@application/dto/user/user.dto';
import { SearchPlayersUseCase } from '@application/usecase/user/search-players.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { PlayerDirectoryService } from '@presentation/services/player-directory.service';

type FriendTab = 'FRIENDS' | 'RECEIVED' | 'SENT' | 'DISCOVER' | 'BLOCKED';
type FriendConfirmation = {
  action: 'UNFRIEND' | 'BLOCK';
  friendship: Friendship;
  targetId: string;
  targetName: string;
};

@Component({
  selector: 'app-friends',
  templateUrl: './friends.component.html',
  styleUrls: ['./friends.component.scss'],
  standalone: false
})
export class FriendsComponent implements OnInit {
  private readonly friendRepo = inject(FRIEND_REPOSITORY_TOKEN);
  private readonly chatRepo = inject(CHAT_REPOSITORY_TOKEN);
  private readonly userProvider = inject(CURRENT_USER_PROVIDER_TOKEN);
  private readonly searchPlayersUseCase = inject(SearchPlayersUseCase);
  private readonly playerDirectory = inject(PlayerDirectoryService);
  private readonly notifyService = inject(NotifyService);
  private readonly router = inject(Router);

  readonly activeTab = signal<FriendTab>('FRIENDS');
  readonly friends = signal<Friendship[]>([]);
  readonly pendingReceived = signal<Friendship[]>([]);
  readonly pendingSent = signal<Friendship[]>([]);
  readonly blockedUsers = signal<UserBlock[]>([]);
  readonly discoverPlayers = signal<PlayerSummary[]>([]);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly searching = signal(false);
  readonly searchPerformed = signal(false);
  readonly pendingActionIds = signal<ReadonlySet<string>>(new Set());
  readonly confirmation = signal<FriendConfirmation | null>(null);

  currentUserId = '';
  searchQuery = '';

  ngOnInit(): void {
    this.currentUserId = this.userProvider.getCurrentUserId() || '';
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    forkJoin({
      friends: this.friendRepo.getFriends(),
      received: this.friendRepo.getPendingReceived(),
      sent: this.friendRepo.getPendingSent(),
      blocked: this.friendRepo.getBlockedUsers()
    }).pipe(
      switchMap(result => {
        const userIds = [
          ...(result.friends.data || []).flatMap(item => [item.requesterId, item.addresseeId]),
          ...(result.received.data || []).flatMap(item => [item.requesterId, item.addresseeId]),
          ...(result.sent.data || []).flatMap(item => [item.requesterId, item.addresseeId]),
          ...(result.blocked.data || []).map(item => item.blockedUserId)
        ];
        return this.playerDirectory.resolve(userIds).pipe(map(directory => ({ ...result, directory })));
      }),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: ({ friends, received, sent, blocked, directory }) => {
        const enrichFriendship = (item: Friendship): Friendship => ({
          ...item,
          requesterName: directory.get(item.requesterId)?.fullName || item.requesterName,
          requesterAvatar: directory.get(item.requesterId)?.avatarUrl || item.requesterAvatar,
          addresseeName: directory.get(item.addresseeId)?.fullName || item.addresseeName,
          addresseeAvatar: directory.get(item.addresseeId)?.avatarUrl || item.addresseeAvatar
        });
        const blockedUsers = (blocked.data || []).map(item => ({
          ...item,
          blockedUserName: directory.get(item.blockedUserId)?.fullName || item.blockedUserName
        }));
        const blockedIds = new Set(blockedUsers.map(item => item.blockedUserId));
        this.blockedUsers.set(blockedUsers);
        this.friends.set((friends.data || []).map(enrichFriendship).filter(item => !blockedIds.has(this.getTargetId(item))));
        this.pendingReceived.set((received.data || []).map(enrichFriendship));
        this.pendingSent.set((sent.data || []).map(enrichFriendship));
      },
      error: () => {
        this.loadFailed.set(true);
        this.notifyService.error('Không thể tải dữ liệu bạn bè. Vui lòng thử lại.');
      }
    });
  }

  switchTab(tab: FriendTab): void {
    this.activeTab.set(tab);
  }

  searchPlayers(): void {
    const query = this.searchQuery.trim();
    if (query.length < 2) {
      this.notifyService.error('Vui lòng nhập ít nhất 2 ký tự để tìm kiếm.');
      return;
    }

    this.searching.set(true);
    this.searchPerformed.set(true);
    this.searchPlayersUseCase.execute(query).pipe(
      finalize(() => this.searching.set(false))
    ).subscribe({
      next: players => this.discoverPlayers.set(players),
      error: () => {
        this.discoverPlayers.set([]);
        this.notifyService.error('Không thể tìm người chơi lúc này. Vui lòng thử lại.');
      }
    });
  }

  sendRequest(player: PlayerSummary): void {
    if (this.getConnectionState(player.userId) !== 'NONE') return;
    this.addPending(player.userId);

    this.friendRepo.sendFriendRequest({
      targetUserId: player.userId
    }).pipe(
      finalize(() => this.removePending(player.userId))
    ).subscribe({
      next: response => {
        if (response.data) {
          this.pendingSent.update(items => [response.data, ...items]);
        }
        this.notifyService.success(`Đã gửi lời mời kết bạn đến ${player.fullName}.`);
      },
      error: () => this.notifyService.error('Không thể gửi lời mời kết bạn. Vui lòng thử lại.')
    });
  }

  respondRequest(friendship: Friendship, accept: boolean): void {
    this.addPending(friendship.friendshipId);
    this.friendRepo.respondFriendRequest(friendship.friendshipId, { accepted: accept }).pipe(
      finalize(() => this.removePending(friendship.friendshipId))
    ).subscribe({
      next: () => {
        this.notifyService.success(accept ? 'Đã chấp nhận lời mời kết bạn.' : 'Đã từ chối lời mời kết bạn.');
        this.loadData();
      },
      error: () => this.notifyService.error('Không thể phản hồi lời mời. Vui lòng thử lại.')
    });
  }

  recallRequest(friendship: Friendship): void {
    this.addPending(friendship.friendshipId);
    this.friendRepo.unfriend(friendship.friendshipId).pipe(
      finalize(() => this.removePending(friendship.friendshipId))
    ).subscribe({
      next: () => {
        this.pendingSent.update(items => items.filter(item => item.friendshipId !== friendship.friendshipId));
        this.notifyService.success('Đã thu hồi lời mời kết bạn.');
      },
      error: () => this.notifyService.error('Không thể thu hồi lời mời. Vui lòng thử lại.')
    });
  }

  requestUnfriend(friendship: Friendship): void {
    this.confirmation.set({
      action: 'UNFRIEND',
      friendship,
      targetId: this.getTargetId(friendship),
      targetName: this.getFriendName(friendship)
    });
  }

  requestBlock(friendship: Friendship): void {
    this.confirmation.set({
      action: 'BLOCK',
      friendship,
      targetId: this.getTargetId(friendship),
      targetName: this.getFriendName(friendship)
    });
  }

  confirmAction(): void {
    const item = this.confirmation();
    if (!item) return;

    this.addPending(item.friendship.friendshipId);
    const action$ = item.action === 'BLOCK'
      ? this.friendRepo.blockUser({
          blockedUserId: item.targetId,
          reason: 'Người dùng chủ động chặn từ danh sách bạn bè'
        }).pipe(map(() => undefined))
      : this.friendRepo.unfriend(item.friendship.friendshipId).pipe(map(() => undefined));

    action$.pipe(
      finalize(() => this.removePending(item.friendship.friendshipId))
    ).subscribe({
      next: () => {
        this.confirmation.set(null);
        this.notifyService.success(item.action === 'BLOCK' ? `Đã chặn ${item.targetName}.` : 'Đã hủy kết bạn.');
        this.loadData();
      },
      error: () => this.notifyService.error(
        item.action === 'BLOCK'
          ? 'Không thể chặn người dùng. Vui lòng thử lại.'
          : 'Không thể hủy kết bạn. Vui lòng thử lại.'
      )
    });
  }

  unblock(block: UserBlock): void {
    this.addPending(block.blockId);
    this.friendRepo.unblockUser(block.blockId).pipe(
      finalize(() => this.removePending(block.blockId))
    ).subscribe({
      next: () => {
        this.blockedUsers.update(items => items.filter(item => item.blockId !== block.blockId));
        this.notifyService.success(`Đã bỏ chặn ${block.blockedUserName || 'người dùng'}.`);
      },
      error: () => this.notifyService.error('Không thể bỏ chặn người dùng. Vui lòng thử lại.')
    });
  }

  startChat(friendship: Friendship): void {
    const targetId = this.getTargetId(friendship);
    this.addPending(`chat-${friendship.friendshipId}`);
    this.chatRepo.getOrCreateDirectRoom({
      targetUserId: targetId
    }).pipe(
      finalize(() => this.removePending(`chat-${friendship.friendshipId}`))
    ).subscribe({
      next: response => {
        if (response.data) void this.router.navigate(['/chat', response.data.roomId]);
      },
      error: () => this.notifyService.error('Không thể mở cuộc trò chuyện. Vui lòng thử lại.')
    });
  }

  getFriendName(friendship: Friendship): string {
    return friendship.requesterId === this.currentUserId
      ? (friendship.addresseeName || 'Người chơi GoatSports')
      : (friendship.requesterName || 'Người chơi GoatSports');
  }

  getFriendAvatar(friendship: Friendship): string {
    return (friendship.requesterId === this.currentUserId
      ? friendship.addresseeAvatar
      : friendship.requesterAvatar) || 'assets/images/default-avatar.png';
  }

  getConnectionState(userId: string): 'FRIEND' | 'PENDING' | 'BLOCKED' | 'NONE' {
    if (this.blockedUsers().some(item => item.blockedUserId === userId)) return 'BLOCKED';
    if (this.friends().some(item => this.getTargetId(item) === userId)) return 'FRIEND';
    if (this.pendingSent().some(item => item.addresseeId === userId) ||
        this.pendingReceived().some(item => item.requesterId === userId)) return 'PENDING';
    return 'NONE';
  }

  isPending(id: string): boolean {
    return this.pendingActionIds().has(id);
  }

  useDefaultAvatar(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith('/assets/images/default-avatar.png')) {
      image.src = 'assets/images/default-avatar.png';
    }
  }

  private getTargetId(friendship: Friendship): string {
    return friendship.requesterId === this.currentUserId
      ? friendship.addresseeId
      : friendship.requesterId;
  }

  private addPending(id: string): void {
    this.pendingActionIds.update(items => new Set([...items, id]));
  }

  private removePending(id: string): void {
    this.pendingActionIds.update(items => {
      const next = new Set(items);
      next.delete(id);
      return next;
    });
  }
}
