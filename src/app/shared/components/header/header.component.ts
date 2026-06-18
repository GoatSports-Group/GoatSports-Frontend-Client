import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../presentation/services/auth.service';
import { BookingService } from '../../../presentation/services/booking.service';
import { RoleEnum } from '../../../domain/enums/role.enum';
import { BookingStatus } from '../../../domain/enums/booking-status.enum';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  public authService = inject(AuthService);
  private bookingService = inject(BookingService);
  private router = inject(Router);

  @Output() menuToggle = new EventEmitter<void>();

  searchQuery: string = '';
  bookingCount: number = 0;
  adminUrl = import.meta.env.NG_APP_ADMIN_API_URL;

  ngOnInit() {
    this.authService.isAuthenticated$.subscribe(authenticated => {
      if (authenticated) {
        this.bookingService.getMyBookings().subscribe(bookings => {
          this.bookingCount = bookings.filter(b => b.status === BookingStatus.PENDING || b.status === BookingStatus.CONFIRMED).length;
        });
      } else {
        this.bookingCount = 0;
      }
    });
  }

  onSearch() {
    this.router.navigate(['/venues'], {
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
}
