import { Component, OnInit, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
import { Notification, NotificationStatus, NotificationType } from '@application/dto/notification/notification.dto';
import { AuthService } from '@presentation/services/auth.service';
import { NotificationService } from '@presentation/services/notification.service';
import { StorageService } from '@presentation/services/storage.service';
import { UserService } from '@presentation/services/user.service';
import { NotifyService } from '@shared/components/notify/notify.service';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
  standalone: false
})
export class NotificationsComponent implements OnInit {
  public authService = inject(AuthService);
  public notificationService = inject(NotificationService);
  private storageService = inject(StorageService);
  private userService = inject(UserService);
  private notifyService = inject(NotifyService);

  public activeFilter: 'ALL' | 'UNREAD' = 'ALL';
  public NotificationStatus = NotificationStatus;
  public isUploadingAvatar = false;
  public localAvatarPreview: string | null = null;

  ngOnInit(): void {
    this.notificationService.fetchNotifications().subscribe();
    this.notificationService.fetchUnreadCount().subscribe();
  }

  get filteredNotifications$(): Observable<Notification[]> {
    return this.notificationService.notifications$.pipe(
      map(items => {
        if (this.activeFilter === 'UNREAD') {
          return items.filter(item => item.status === NotificationStatus.UNREAD);
        }
        return items;
      })
    );
  }

  setFilter(filter: 'ALL' | 'UNREAD'): void {
    this.activeFilter = filter;
  }

  onMarkRead(notification: Notification, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (notification.status === NotificationStatus.UNREAD) {
      this.notificationService.markAsRead(notification.notificationId).subscribe();
    }
  }

  onMarkAllRead(): void {
    this.notificationService.markAllRead().subscribe();
  }

  onDelete(notification: Notification, event: Event): void {
    event.stopPropagation();
    this.notificationService.deleteNotification(notification.notificationId).subscribe();
  }

  get fallbackAvatar(): string {
    if (this.localAvatarPreview) {
      return this.localAvatarPreview;
    }
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

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const user = this.authService.currentUser;
    if (!user?.userId) {
      this.notifyService.error('Vui lòng đăng nhập để cập nhật ảnh đại diện');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.notifyService.error('Ảnh đại diện không được vượt quá 5MB');
      input.value = '';
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    this.localAvatarPreview = previewUrl;

    this.isUploadingAvatar = true;
    this.storageService.uploadAvatar(file).pipe(
      switchMap(tempKey => this.userService.updateAvatar(user.userId, tempKey)),
      switchMap(() => this.authService.getCurrentUser()),
      finalize(() => {
        this.isUploadingAvatar = false;
        input.value = '';
      })
    ).subscribe({
      next: (refreshedUser) => {
        this.authService.updateCurrentUser(refreshedUser);
        this.notifyService.success('Cập nhật ảnh đại diện thành công!');
      },
      error: (err) => {
        this.localAvatarPreview = null;
        console.error('Failed to update avatar:', err);
        this.notifyService.error(err?.error?.message || 'Không thể cập nhật ảnh đại diện, vui lòng thử lại');
      }
    });
  }

  getNotificationIcon(type?: NotificationType): string {
    switch (type) {
      case NotificationType.BOOKING:
        return 'calendar';
      case NotificationType.PAYMENT:
        return 'credit-card';
      case NotificationType.OWNER_APPLICATION:
        return 'store';
      case NotificationType.USER:
        return 'user';
      case NotificationType.SYSTEM:
      default:
        return 'bell';
    }
  }

  formatTime(dateStr?: string): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      if (diffDays === 1) return 'Hôm qua';
      if (diffDays < 7) return `${diffDays} ngày trước`;

      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }
}
