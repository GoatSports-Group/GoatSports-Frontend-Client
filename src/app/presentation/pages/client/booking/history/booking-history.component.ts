import { PAGE_SIZE } from '@shared/constants/page-size';
import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { catchError, forkJoin, map, of } from 'rxjs';
import { BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/booking.repository';
import {
  Booking,
  BookingStatus,
  BOOKING_STATUS_LABELS,
  CANCELLATION_STATUS_LABELS
} from '@application/dto/booking/booking.dto';
import {
  BOOKING_TONE, CANCELLATION_TONE, countdownLabel, formatPrice, isActiveBooking, playDay, weekdayLabel
} from '../booking-view';

/** UPCOMING: luot con hieu luc chua toi gio ket thuc (server loc theo gio choi, khong chi trang thai). */
type BookingStatusFilter = BookingStatus | 'ALL' | 'UPCOMING';

interface StatusTab {
  value: BookingStatusFilter;
  label: string;
  icon: string;
  empty: { title: string; text: string };
}

const STATUS_TABS: readonly StatusTab[] = [
  { value: 'ALL', label: 'Tất cả', icon: 'ticket',
    empty: { title: 'Bạn chưa đặt sân nào', text: 'Tìm một sân gần bạn, chọn khung giờ và giữ chỗ trong vài bước.' } },
  { value: 'UPCOMING', label: 'Sắp diễn ra', icon: 'calendar-clock',
    empty: { title: 'Chưa có trận nào sắp tới', text: 'Lượt đặt đã xác nhận sẽ nằm ở đây kèm vé QR để nhận sân.' } },
  { value: BookingStatus.COMPLETED, label: 'Đã chơi', icon: 'check-circle-2',
    empty: { title: 'Chưa có lượt chơi hoàn thành', text: 'Sau mỗi lượt chơi, bạn có thể đánh giá sân ngay trên vé.' } },
  { value: BookingStatus.NO_SHOW, label: 'Không đến', icon: 'user-x',
    empty: { title: 'Không có lượt nào bỏ lỡ', text: 'Lượt đã cọc mà hết giờ chơi chưa nhận sân sẽ nằm ở đây.' } },
  { value: BookingStatus.REFUND_PENDING, label: 'Chờ hoàn tiền', icon: 'hourglass',
    empty: { title: 'Không có khoản nào chờ hoàn', text: 'Yêu cầu hủy được chấp thuận sẽ hiện ở đây cho tới khi tiền về tài khoản.' } },
  { value: BookingStatus.REFUNDED, label: 'Đã hoàn tiền', icon: 'rotate-ccw',
    empty: { title: 'Chưa có khoản hoàn nào', text: 'Các lượt đã hoàn cọc sẽ được lưu ở đây.' } },
  { value: BookingStatus.CANCELLED, label: 'Đã hủy', icon: 'calendar-x',
    empty: { title: 'Không có lượt nào bị hủy', text: 'Lượt đặt bạn hủy hoặc hết giờ giữ chỗ sẽ nằm ở đây.' } }
];

/** Ve dat san cua toi: tab gach chan co so dem, luoi the ve (cuong ngay + than ve), phan trang 12. */
@Component({
  selector: 'app-booking-history',
  templateUrl: './booking-history.component.html',
  styleUrls: ['./booking-history.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class BookingHistoryComponent {
  private readonly bookingRepository = inject(BOOKING_REPOSITORY_TOKEN);
  readonly pageSize = PAGE_SIZE.grid;

  readonly bookings = signal<Booking[]>([]);
  readonly loading = signal(true);
  readonly paging = signal(false);
  @ViewChild('listTop') private listTop?: ElementRef<HTMLElement>;
  readonly error = signal<string | null>(null);
  readonly selectedStatus = signal<BookingStatusFilter>('ALL');
  readonly page = signal(0);
  readonly total = signal(0);
  /** So ve moi tab (size 1, doc meta.total); null khi chua co / loi thi khong hien. */
  readonly counts = signal<Partial<Record<BookingStatusFilter, number>>>({});

  readonly statusTabs = STATUS_TABS;
  readonly statusLabels = BOOKING_STATUS_LABELS;
  readonly cancellationLabels = CANCELLATION_STATUS_LABELS;
  readonly bookingTone = BOOKING_TONE;
  readonly cancellationTone = CANCELLATION_TONE;
  readonly formatPrice = formatPrice;
  readonly playDay = playDay;
  readonly weekdayLabel = weekdayLabel;
  readonly countdownLabel = countdownLabel;
  readonly isActive = isActiveBooking;

  constructor() {
    this.loadBookings(0);
    this.loadCounts();
  }

  get activeTab(): StatusTab {
    return STATUS_TABS.find(tab => tab.value === this.selectedStatus()) ?? STATUS_TABS[0];
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

  private loadCounts(): void {
    forkJoin(STATUS_TABS.map(tab => this.bookingRepository
      .getMyBookingHistory(tab.value === 'ALL' ? undefined : tab.value as BookingStatus, 0, 1).pipe(
        map(response => [tab.value, response.data.meta.total] as const),
        catchError(() => of(null))
      ))).subscribe(entries => this.counts.set(Object.fromEntries(entries.filter(entry => !!entry))));
  }

  private loadBookings(page: number, keepCurrent = false): void {
    (keepCurrent ? this.paging : this.loading).set(true);
    this.error.set(null);

    const status = this.selectedStatus() === 'ALL' ? undefined : this.selectedStatus() as BookingStatus;
    // 'UPCOMING' khong phai BookingStatus nhung API nhan chuoi trang thai, server hieu bo loc nay.
    this.bookingRepository.getMyBookingHistory(status, page, this.pageSize).subscribe({
      next: response => {
        const pageData = response.data;
        this.bookings.set(pageData.result);
        this.page.set(pageData.meta.page);
        this.total.set(pageData.meta.total);
        this.loading.set(false);
        if (keepCurrent) { this.paging.set(false); this.scrollListIntoView(); }
      },
      error: () => {
        this.error.set('Kiểm tra kết nối mạng rồi thử lại.');
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
