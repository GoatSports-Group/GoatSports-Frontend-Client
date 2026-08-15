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

  @Output() menuToggle = new EventEmitter<void>();

  searchQuery: string = '';
  adminUrl = environment.adminApiUrl;
  isNotifOpen = false;

  ngOnInit() {
    this.authService.isAuthenticated$;
  }

  onSearch() {
    this.router.navigate(['/home'], {
      queryParams: { search: this.searchQuery.trim() }
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
    return user?.fullName
      ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.fullName)}`
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80';
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
      next: () => this.navigateFromNotification(notification)
    });
  }

  private navigateFromNotification(notification: Notification): void {
    if (notification.type === NotificationType.BOOKING) {
      this.router.navigate(['/my-bookings']);
    } else if (notification.type === NotificationType.OWNER_APPLICATION) {
      this.router.navigate(['/owner-application']);
    }
  }

  markAllRead() {
    this.notificationService.markAllRead().subscribe({
      error: (err) => console.error('Failed to mark all as read:', err)
    });
  }

  deleteNotification(notification: Notification, event: Event): void {
    event.stopPropagation();
    this.notificationService.deleteNotification(notification.notificationId).subscribe({
      error: (err) => console.error('Failed to delete notification:', err)
    });
  }
}
