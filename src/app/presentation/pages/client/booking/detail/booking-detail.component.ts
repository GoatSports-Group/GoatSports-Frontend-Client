import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import { BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/booking.repository';
import { REVIEW_REPOSITORY_TOKEN } from '@application/ports/persistence/review.repository';
import {
  Booking,
  BookingStatus,
  BOOKING_STATUS_COLORS,
  BOOKING_STATUS_LABELS,
  CancellationStatus,
  CANCELLATION_STATUS_LABELS
} from '@application/dto/booking/booking.dto';
import { NotifyService } from '@shared/components/notify/notify.service';
import { QrCodeComponent } from '@shared/components/qr-code/qr-code.component';

@Component({
  selector: 'app-booking-detail',
  templateUrl: './booking-detail.component.html',
  styleUrls: ['./booking-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class BookingDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly bookingRepository = inject(BOOKING_REPOSITORY_TOKEN);
  private readonly reviewRepository = inject(REVIEW_REPOSITORY_TOKEN);
  private readonly notifyService = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('ticketQr') private ticketQr?: QrCodeComponent;

  readonly booking = signal<Booking | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly bookingId = signal('');

  readonly showCancelModal = signal(false);
  readonly cancelReason = signal('');
  readonly cancelling = signal(false);
  readonly showReviewModal = signal(false);
  readonly reviewRating = signal(5);
  readonly reviewContent = signal('');
  readonly reviewing = signal(false);

  readonly statusLabels = BOOKING_STATUS_LABELS;
  readonly statusColors = BOOKING_STATUS_COLORS;
  readonly cancellationStatusLabels = CANCELLATION_STATUS_LABELS;
  readonly cancellationStatus = CancellationStatus;

  readonly canCancel = computed(() => {
    const booking = this.booking();
    return !!booking
      && !booking.cancellation
      && [BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT].includes(booking.status);
  });

  readonly canReview = computed(() => {
    const booking = this.booking();
    return booking?.status === BookingStatus.COMPLETED && !booking.review;
  });

  readonly hasValidTicket = computed(() => {
    const booking = this.booking();
    return !!booking?.qrCode && [
      BookingStatus.CONFIRMED,
      BookingStatus.CHECKED_IN,
      BookingStatus.COMPLETED
    ].includes(booking.status);
  });

  readonly estimatedRefund = computed(() => {
    const booking = this.booking();
    const policy = booking?.cancellationPolicy;
    if (!booking?.depositPaymentId || !policy) return 0;
    const startAt = new Date(`${booking.playDate}T${booking.startTime}`);
    const hoursBefore = Math.floor((startAt.getTime() - Date.now()) / 3_600_000);
    if (hoursBefore >= policy.fullRefundHoursBefore) return booking.depositAmount;
    if (hoursBefore >= policy.partialRefundHoursBefore) {
      return Math.round(booking.depositAmount * policy.partialRefundPercentage / 100);
    }
    return 0;
  });

  constructor() {
    this.route.paramMap.pipe(
      map(params => params.get('id') ?? ''),
      filter(Boolean),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(bookingId => {
      this.bookingId.set(bookingId);
      this.loadBooking();
    });
  }

  loadBooking(): void {
    this.loading.set(true);
    this.error.set(null);
    this.bookingRepository.getBookingById(this.bookingId()).subscribe({
      next: response => {
        this.booking.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.booking.set(null);
        this.error.set('Không thể tải vé đặt sân hoặc vé không thuộc tài khoản của bạn.');
        this.loading.set(false);
      }
    });
  }

  openCancelModal(): void {
    this.cancelReason.set('');
    this.showCancelModal.set(true);
  }

  closeCancelModal(): void {
    if (!this.cancelling()) this.showCancelModal.set(false);
  }

  submitCancel(): void {
    const reason = this.cancelReason().trim();
    if (!reason) {
      this.notifyService.error('Vui lòng nhập lý do hủy sân.');
      return;
    }

    this.cancelling.set(true);
    this.bookingRepository.cancelBooking(this.bookingId(), { reason }).subscribe({
      next: response => {
        this.booking.update(booking => booking ? { ...booking, cancellation: response.data } : booking);
        this.cancelling.set(false);
        this.showCancelModal.set(false);
        this.notifyService.success('Đã gửi yêu cầu hủy sân. Bạn có thể theo dõi tiến trình ngay trên vé.');
      },
      error: error => {
        this.cancelling.set(false);
        this.notifyService.error(error?.error?.message || 'Không thể gửi yêu cầu hủy sân.');
      }
    });
  }

  openReviewModal(): void {
    this.reviewRating.set(5);
    this.reviewContent.set('');
    this.showReviewModal.set(true);
  }

  closeReviewModal(): void {
    if (!this.reviewing()) this.showReviewModal.set(false);
  }

  submitReview(): void {
    this.reviewing.set(true);
    this.reviewRepository.createReview({
      bookingId: this.bookingId(),
      rating: this.reviewRating(),
      content: this.reviewContent().trim() || undefined
    }).subscribe({
      next: response => {
        this.booking.update(booking => booking ? { ...booking, review: response.data } : booking);
        this.reviewing.set(false);
        this.showReviewModal.set(false);
        this.notifyService.success('Cảm ơn bạn đã đánh giá sân.');
      },
      error: error => {
        this.reviewing.set(false);
        this.notifyService.error(error?.error?.message || 'Không thể gửi đánh giá lúc này.');
      }
    });
  }

  async downloadQr(): Promise<void> {
    const booking = this.booking();
    if (!booking?.qrCode || !this.ticketQr) return;
    try {
      await this.ticketQr.download(`goat-sports-${booking.bookingCode}.png`);
    } catch {
      this.notifyService.error('Không thể tải mã QR. Vui lòng thử lại.');
    }
  }

  formatPrice(price: number | null | undefined): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
      .format(price ?? 0);
  }
}
