import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
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
  readonly pageSize = 12;

  readonly bookings = signal<Booking[]>([]);
  readonly loading = signal(true);
  readonly paging = signal(false);
  @ViewChild('listTop') private listTop?: ElementRef<HTMLElement>;
  readonly error = signal<string | null>(null);
  readonly selectedStatus = signal<BookingStatusFilter>('ALL');
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly total = signal(0);

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
    this.loadBookings(0);
  }

  onTabChange(status: BookingStatusFilter): void {
    if (status === this.selectedStatus()) return;
    this.selectedStatus.set(status);
    this.loadBookings(0);
  }

  /** Doi trang giu danh sach hien tai (lam mo) thay vi skeleton; bo loc doi moi dung skeleton. */
  changePage(page: number): void {
    this.loadBookings(page, true);
  }

  retry(): void {
    this.loadBookings(this.page());
  }

  formatPrice(price: number | null | undefined): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
      .format(price ?? 0);
  }

  viewDetail(bookingId: string): void {
    void this.router.navigate(['/booking/detail', bookingId]);
  }

  private loadBookings(page: number, keepCurrent = false): void {
    (keepCurrent ? this.paging : this.loading).set(true);
    this.error.set(null);

    const status = this.selectedStatus() === 'ALL' ? undefined : this.selectedStatus();
    this.bookingRepository.getMyBookingHistory(status, page, this.pageSize).subscribe({
      next: response => {
        const pageData = response.data;
        this.bookings.set(pageData.result);
        this.page.set(pageData.meta.page);
        this.totalPages.set(pageData.meta.pages);
        this.total.set(pageData.meta.total);
        this.loading.set(false);
        if (keepCurrent) { this.paging.set(false); this.scrollListIntoView(); }
      },
      error: () => {
        this.error.set('Không thể tải lịch sử đặt sân. Vui lòng thử lại.');
        this.loading.set(false);
        this.paging.set(false);
      }
    });
  }

  private scrollListIntoView(): void {
    const element = this.listTop?.nativeElement;
    if (element && element.getBoundingClientRect().top < 0) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
