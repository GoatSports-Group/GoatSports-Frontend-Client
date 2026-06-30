import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@presentation/services/auth.service';
import { NotificationService } from '@presentation/services/notification.service';
import { RoleEnum } from '@application/dto/user/user.dto';
import { Notification } from '@domain/entity/notification';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  public authService = inject(AuthService);
  public notificationService = inject(NotificationService);
  private router = inject(Router);

  @Output() menuToggle = new EventEmitter<void>();

  searchQuery: string = '';
  adminUrl = import.meta.env.NG_APP_ADMIN_API_URL;

  ngOnInit() {
    this.authService.isAuthenticated$;
  }

  onSearch() {
    this.router.navigate(['/home'], {
      queryParams: { search: this.searchQuery.trim() }
    });
  }

  logout() {
    this.authService.logout().subscribe();
  }

  redirectToLogin() {
    const clientUrl = import.meta.env.NG_APP_CLIENT_API_URL;
    const authUrl = import.meta.env.NG_APP_AUTH_API_URL;
    const currentUrl = encodeURIComponent(`${clientUrl}${this.router.url}`);
    window.location.href = `${authUrl}/login?redirect=${currentUrl}`;
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
    this.notificationService.markAsRead(notification.notificationId);
  }
}
