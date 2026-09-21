import { Component, EventEmitter, HostListener, OnInit, Output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@presentation/services/auth.service';
import { NotificationService } from '@presentation/services/notification.service';
import { RoleEnum } from '@application/dto/user/user.dto';
import {
  Notification,
  NotificationStatus,
  NotificationType
} from '@application/dto/notification/notification.dto';
import { environment } from '@environments/environment';
import { formatRelativeTime } from '@presentation/shared/utils/date-trend.utils';
import { NotifyService } from '@shared/components/notify/notify.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: false
})
export class HeaderComponent implements OnInit {
  readonly getRelativeTime = formatRelativeTime;
  public authService = inject(AuthService);
  public notificationService = inject(NotificationService);
  private router = inject(Router);
  private notify = inject(NotifyService);

  @Output() menuToggle = new EventEmitter<void>();

  searchQuery: string = '';
  adminUrl = environment.adminApiUrl;
  isNotifOpen = false;

  get isConnectionRoute(): boolean {
    return this.router.url.startsWith('/friends') || this.router.url.startsWith('/chat');
  }

  get connectionLabel(): string {
    if (this.router.url.startsWith('/chat')) return 'Tin Nhắn';
    if (this.router.url.startsWith('/friends')) return 'Bạn Bè';
    return 'Kết Nối';
  }

  ngOnInit() {
    this.authService.isAuthenticated$;
  }

  onSearch() {
    this.router.navigate(['/venues'], {
      queryParams: { keyword: this.searchQuery.trim() || null }
    });
  }

  private authApiBase = environment.authApiUrl;

  logout() {
    this.authService.logout().subscribe();
  }

  redirectToLogin() {
    window.location.href = `${this.authApiBase}/login?redirect=${encodeURIComponent(window.location.origin + this.router.url)}`;
  }

  toggleNotifDropdown(event: Event): void {
    event.stopPropagation();
    this.isNotifOpen = !this.isNotifOpen;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isNotifOpen = false;
  }

  get fallbackAvatar(): string {
    const user = this.authService.currentUser;
    if (user?.avatarUrl) {
      return user.avatarUrl;
    }
    return user?.fullName
      ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.fullName)}`
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80';
  }

  onAvatarImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const user = this.authService.currentUser;
    const fallback = user?.fullName
      ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.fullName)}`
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80';
    if (img.src !== fallback) {
      img.src = fallback;
    }
  }

  getRoleLabel(roleName?: string): string {
    if (!roleName) return 'Khách';
    const normalized = roleName.toUpperCase();
    switch (normalized) {
      case 'ADMIN':
        return RoleEnum.ADMIN;
      case 'PLAYER':
        return RoleEnum.PLAYER;
      case 'VENUE_OWNER':
        return RoleEnum.VENUE_OWNER;
      default:
        return roleName;
    }
  }

  onNotificationClick(notification: Notification): void {
    this.isNotifOpen = false;

    if (notification.status !== NotificationStatus.UNREAD) {
      this.navigateFromNotification(notification);
      return;
    }

    this.notificationService.markAsRead(notification.notificationId).subscribe({
      next: () => this.navigateFromNotification(notification),
      error: () => {
        this.notify.error('Không thể cập nhật thông báo.');
        this.navigateFromNotification(notification);
      }
    });
  }

  private navigateFromNotification(notification: Notification): void {
    const referenceId = notification.referenceId;
    switch ((notification.referenceType || '').toUpperCase()) {
      case 'BOOKING':
        void this.router.navigate(referenceId ? ['/booking/detail', referenceId] : ['/booking/history']);
        break;
      case 'FRIENDSHIP':
        void this.router.navigate(['/friends']);
        break;
      case 'MESSAGE':
        void this.router.navigate(['/chat']);
        break;
      case 'CLUB':
      case 'CLUB_ACTIVITY':
        void this.router.navigate(referenceId ? ['/clubs', referenceId] : ['/clubs/my']);
        break;
      case 'CLUB_MEMBERSHIP_REQUEST':
        void this.router.navigate(referenceId ? ['/clubs', referenceId] : ['/clubs/my'], { fragment: 'membership-requests' });
        break;
      case 'CLUB_PUBLIC':
        void this.router.navigate(referenceId ? ['/clubs', referenceId] : ['/clubs']);
        break;
      case 'CLUB_INVITATION':
        void this.router.navigate(['/clubs']);
        break;
      case 'TOURNAMENT':
        void this.router.navigate(referenceId ? ['/tournaments', referenceId] : ['/tournaments']);
        break;
      case 'MATCHMAKING_SESSION':
        void this.router.navigate(['/matchmaking']);
        break;
      default:
        if (notification.type === NotificationType.BOOKING) {
          void this.router.navigate(['/booking/history']);
        }
    }
  }

  markAllRead() {
    this.notificationService.markAllRead().subscribe({
      error: () => this.notify.error('Không thể cập nhật thông báo.')
    });
  }
}
