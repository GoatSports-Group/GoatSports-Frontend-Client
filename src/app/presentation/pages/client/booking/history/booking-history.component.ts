import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/booking.repository';
import { Booking, BookingStatus, BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from '@application/dto/booking/booking.dto';

@Component({
  selector: 'app-booking-history',
  templateUrl: './booking-history.component.html',
  styleUrls: ['./booking-history.component.scss'],
  standalone: false
})
export class BookingHistoryComponent implements OnInit {
  private bookingRepo = inject(BOOKING_REPOSITORY_TOKEN);
  private router = inject(Router);

  bookings: Booking[] = [];
  loading = true;
  selectedStatus = 'ALL';

  statusTabs = [
    { value: 'ALL', label: 'Tất cả vé' },
    { value: 'CONFIRMED', label: 'Đã xác nhận' },
    { value: 'CHECKED_IN', label: 'Đã nhận sân' },
    { value: 'CANCELLED', label: 'Đã hủy / Hoàn tiền' }
  ];

  statusLabels = BOOKING_STATUS_LABELS;
  statusColors = BOOKING_STATUS_COLORS;

  ngOnInit(): void {
    this.loadBookings();
  }

  loadBookings(): void {
    this.loading = true;
    this.bookingRepo.getMyBookingHistory(this.selectedStatus).subscribe({
      next: res => {
        this.bookings = res?.data || [];
        this.loading = false;
      },
      error: err => {
        console.error('Error loading booking history:', err);
        this.bookings = [];
        this.loading = false;
      }
    });
  }

  onTabChange(status: string): void {
    this.selectedStatus = status;
    this.loadBookings();
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  }

  viewDetail(bookingId: string): void {
    this.router.navigate(['/booking/detail', bookingId]);
  }
}
