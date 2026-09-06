import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FRIEND_REPOSITORY_TOKEN } from '@application/ports/persistence/friend.repository';
import { CHAT_REPOSITORY_TOKEN } from '@application/ports/persistence/chat.repository';
import { CURRENT_USER_PROVIDER_TOKEN } from '@application/ports/current-user.provider';
import { Friendship, FriendshipStatus } from '@application/dto/friend/friend.dto';
import { NotifyService } from '@shared/components/notify/notify.service';

@Component({
  selector: 'app-friends',
  templateUrl: './friends.component.html',
  styleUrls: ['./friends.component.scss'],
  standalone: false
})
export class FriendsComponent implements OnInit {
  private friendRepo = inject(FRIEND_REPOSITORY_TOKEN);
  private chatRepo = inject(CHAT_REPOSITORY_TOKEN);
  private userProvider = inject(CURRENT_USER_PROVIDER_TOKEN);
  private notifyService = inject(NotifyService);
  private router = inject(Router);

  currentUserId = '';
  activeTab: 'FRIENDS' | 'RECEIVED' | 'SENT' | 'DISCOVER' = 'FRIENDS';

  friends: Friendship[] = [];
  pendingReceived: Friendship[] = [];
  pendingSent: Friendship[] = [];
  discoverPlayers: any[] = [];

  loading = true;
  searchQuery = '';

  ngOnInit(): void {
    this.currentUserId = this.userProvider.getCurrentUserId() || '';
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.friendRepo.getFriends().subscribe({
      next: res => {
        this.friends = res?.data || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });

    this.friendRepo.getPendingReceived().subscribe({
      next: res => {
        this.pendingReceived = res?.data || [];
      }
    });

    this.friendRepo.getPendingSent().subscribe({
      next: res => {
        this.pendingSent = res?.data || [];
      }
    });
  }

  switchTab(tab: 'FRIENDS' | 'RECEIVED' | 'SENT' | 'DISCOVER'): void {
    this.activeTab = tab;
    if (tab === 'DISCOVER') {
      this.searchPlayers();
    }
  }

  searchPlayers(): void {
    // Sample mock discovery players if no query or specific query
    this.discoverPlayers = [
      {
        userId: '11111111-1111-1111-1111-111111111111',
        fullName: 'Nguyễn Văn Hùng',
        avatarUrl: 'assets/images/default-avatar.png',
        sports: ['Cầu lông', 'Pickleball'],
        level: 'Bán chuyên (Trình 3.5)',
        district: 'Quận 7, TP.HCM'
      },
      {
        userId: '22222222-2222-2222-2222-222222222222',
        fullName: 'Trần Minh Tuấn',
        avatarUrl: 'assets/images/default-avatar.png',
        sports: ['Bóng đá sân 7', 'Bóng rổ'],
        level: 'Phong trào',
        district: 'Bình Thạnh, TP.HCM'
      },
      {
        userId: '33333333-3333-3333-3333-333333333333',
        fullName: 'Lê Hoàng Nam',
        avatarUrl: 'assets/images/default-avatar.png',
        sports: ['Tennis', 'Pickleball'],
        level: 'Trung bình khá (Trình 3.0)',
        district: 'TP. Thủ Đức, TP.HCM'
      }
    ];
  }

  sendRequest(player: any): void {
    this.friendRepo.sendFriendRequest({
      targetUserId: player.userId,
      targetUserName: player.fullName,
      targetUserAvatar: player.avatarUrl
    }).subscribe({
      next: () => {
        this.notifyService.success(`Đã gửi lời mời kết bạn đến ${player.fullName}!`);
        this.loadData();
      },
      error: (err: any) => {
        const msg = err?.error?.message || 'Có lỗi xảy ra khi gửi lời mời.';
        this.notifyService.error(msg);
      }
    });
  }

  respondRequest(friendship: Friendship, accept: boolean): void {
    this.friendRepo.respondFriendRequest(friendship.friendshipId, { accepted: accept }).subscribe({
      next: () => {
        this.notifyService.success(accept ? 'Đã chấp nhận lời mời kết bạn!' : 'Đã từ chối lời mời.');
        this.loadData();
      },
      error: (err: any) => {
        const msg = err?.error?.message || 'Có lỗi xảy ra khi phản hồi.';
        this.notifyService.error(msg);
      }
    });
  }

  unfriend(friendship: Friendship): void {
    const targetId = friendship.requesterId === this.currentUserId
      ? friendship.addresseeId
      : friendship.requesterId;

    this.friendRepo.unfriend(targetId).subscribe({
      next: () => {
        this.notifyService.success('Đã hủy kết bạn.');
        this.loadData();
      }
    });
  }

  startChat(friendship: Friendship): void {
    const isRequester = friendship.requesterId === this.currentUserId;
    const targetId = isRequester ? friendship.addresseeId : friendship.requesterId;
    const targetName = isRequester ? friendship.addresseeName : friendship.requesterName;
    const targetAvatar = isRequester ? friendship.addresseeAvatar : friendship.requesterAvatar;

    this.chatRepo.getOrCreateDirectRoom({
      targetUserId: targetId,
      targetUserName: targetName,
      targetUserAvatar: targetAvatar
    }).subscribe({
      next: res => {
        if (res?.data) {
          this.router.navigate(['/chat', res.data.roomId]);
        }
      }
    });
  }

  getFriendName(friendship: Friendship): string {
    return friendship.requesterId === this.currentUserId
      ? (friendship.addresseeName || 'Người chơi Goat')
      : (friendship.requesterName || 'Người chơi Goat');
  }

  getFriendAvatar(friendship: Friendship): string {
    return (friendship.requesterId === this.currentUserId
      ? friendship.addresseeAvatar
      : friendship.requesterAvatar) || 'assets/images/default-avatar.png';
  }
}
