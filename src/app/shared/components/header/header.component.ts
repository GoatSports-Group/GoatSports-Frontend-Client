import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@presentation/services/auth.service';
import { NotificationService } from '@presentation/services/notification.service';
import { RoleEnum } from '@application/dto/user/user.dto';
import { Notification } from '@domain/entities/notification';
import { environment } from '@environments/environment';

@Component({
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss'],
    standalone: false
})
export class HeaderComponent implements OnInit {
  public authService = inject(AuthService);
  public notificationService = inject(NotificationService);
  private router = inject(Router);

  @Output() menuToggle = new EventEmitter<void>();

  searchQuery: string = '';
  adminUrl = environment.adminApiUrl;

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

  onNotificationClick(notification: Notification) {
    this.notificationService.markAsRead(notification.notificationId).subscribe();
  }

  markAllRead() {
    this.notificationService.markAllRead().subscribe();
  }
}
