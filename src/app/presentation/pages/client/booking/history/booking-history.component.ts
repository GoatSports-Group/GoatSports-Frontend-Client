import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/booking.repository';
import {
  Booking,
  BookingStatus,
  BOOKING_STATUS_COLORS,
  BOOKING_STATUS_LABELS,
  CANCELLATION_STATUS_LABELS
} from '@application/dto/booking/booking.dto';

type BookingStatusFilter = BookingStatus | 'ALL';

@Component({
  selector: 'app-booking-history',
  templateUrl: './booking-history.component.html',
  styleUrls: ['./booking-history.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class BookingHistoryComponent {
  private readonly bookingRepository = inject(BOOKING_REPOSITORY_TOKEN);
  private readonly router = inject(Router);
  private readonly pageSize = 12;

  readonly bookings = signal<Booking[]>([]);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedStatus = signal<BookingStatusFilter>('ALL');
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly total = signal(0);
  readonly hasMore = computed(() => this.page() + 1 < this.totalPages());

  readonly statusTabs: ReadonlyArray<{ value: BookingStatusFilter; label: string }> = [
    { value: 'ALL', label: 'Tất cả' },
    { value: BookingStatus.CONFIRMED, label: 'Sắp diễn ra' },
    { value: BookingStatus.COMPLETED, label: 'Đã hoàn thành' },
    { value: BookingStatus.REFUND_PENDING, label: 'Chờ hoàn tiền' },
    { value: BookingStatus.REFUNDED, label: 'Đã hoàn tiền' },
    { value: BookingStatus.CANCELLED, label: 'Đã hủy' }
  ];

  readonly statusLabels = BOOKING_STATUS_LABELS;
  readonly statusColors = BOOKING_STATUS_COLORS;
  readonly cancellationStatusLabels = CANCELLATION_STATUS_LABELS;

  constructor() {
    this.loadBookings(true);
  }

  onTabChange(status: BookingStatusFilter): void {
    if (status === this.selectedStatus()) return;
    this.selectedStatus.set(status);
    this.loadBookings(true);
  }

  loadMore(): void {
    if (!this.hasMore() || this.loadingMore()) return;
    this.loadBookings(false);
  }

  retry(): void {
    this.loadBookings(true);
  }

  formatPrice(price: number | null | undefined): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
      .format(price ?? 0);
  }

  viewDetail(bookingId: string): void {
    void this.router.navigate(['/booking/detail', bookingId]);
  }

  private loadBookings(reset: boolean): void {
    const targetPage = reset ? 0 : this.page() + 1;
    if (reset) {
      this.loading.set(true);
      this.bookings.set([]);
      this.error.set(null);
    } else {
      this.loadingMore.set(true);
    }

    const status = this.selectedStatus() === 'ALL' ? undefined : this.selectedStatus();
    this.bookingRepository.getMyBookingHistory(status, targetPage, this.pageSize).subscribe({
      next: response => {
        const pageData = response.data;
        this.bookings.update(current => reset
          ? pageData.result
          : [...current, ...pageData.result]
        );
        this.page.set(pageData.meta.page);
        this.totalPages.set(pageData.meta.pages);
        this.total.set(pageData.meta.total);
        this.loading.set(false);
        this.loadingMore.set(false);
      },
      error: () => {
        this.error.set('Không thể tải lịch sử đặt sân. Vui lòng thử lại.');
        this.loading.set(false);
        this.loadingMore.set(false);
      }
    });
  }
}
