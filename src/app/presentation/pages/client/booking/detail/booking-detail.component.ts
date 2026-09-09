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
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, timer } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, switchMap } from 'rxjs/operators';
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
import { BANK_ACCOUNT_REPOSITORY_TOKEN } from '@application/ports/persistence/bank-account.repository';

@Component({
  selector: 'app-booking-detail',
  templateUrl: './booking-detail.component.html',
  styleUrls: ['./booking-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class BookingDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly bankAccountRepository = inject(BANK_ACCOUNT_REPOSITORY_TOKEN);
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
  readonly claimingRefund = signal(false);
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
      && [BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT].includes(booking.status)
      && new Date(`${booking.playDate}T${booking.startTime}`).getTime() > Date.now();
  });

  readonly automaticCancellation = computed(() => {
    const booking = this.booking();
    if (!booking) return false;
    if (booking.status === BookingStatus.PENDING_PAYMENT && !booking.depositPaymentId) return true;
    const createdAt = new Date(booking.createdAt).getTime();
    return Number.isFinite(createdAt)
      && Date.now() >= createdAt
      && Date.now() <= createdAt + 60 * 60 * 1000;
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
    if (!booking?.depositPaymentId) return 0;
    if (this.automaticCancellation()) return booking.depositAmount;
    if (!policy) return 0;
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

    timer(5000, 5000).pipe(
      filter(() => this.booking()?.cancellation?.status === CancellationStatus.REFUND_PROCESSING),
      switchMap(() => this.bookingRepository.getBookingById(this.bookingId()).pipe(
        catchError(() => EMPTY)
      )),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(response => this.applyBookingUpdate(response.data));
  }

  loadBooking(): void {
    this.loading.set(true);
    this.error.set(null);
    this.bookingRepository.getBookingById(this.bookingId()).subscribe({
      next: response => {
        this.applyBookingUpdate(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.booking.set(null);
        this.error.set('Không thể tải vé đặt sân hoặc vé không thuộc tài khoản của bạn.');
        this.loading.set(false);
      }
    });
  }

  private applyBookingUpdate(nextBooking: Booking): void {
    const previousStatus = this.booking()?.cancellation?.status;
    const cancellation = nextBooking.cancellation;
    this.booking.set(nextBooking);

    if (previousStatus !== CancellationStatus.REFUND_PROCESSING || !cancellation) return;
    if (cancellation.status === CancellationStatus.REFUNDED) {
      this.notifyService.success('Tiền hoàn đã được chuyển về tài khoản ngân hàng.');
    } else if (
      cancellation.status === CancellationStatus.REFUND_FAILED
      || cancellation.status === CancellationStatus.REFUND_AWAITING_BANK_ACCOUNT
    ) {
      this.notifyService.error(
        cancellation.refundFailureReason
          || 'Lệnh hoàn tiền thất bại. Vui lòng kiểm tra và liên kết lại tài khoản ngân hàng.'
      );
    }
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
        this.cancelling.set(false);
        this.showCancelModal.set(false);
        const automatic = response.data.reviewMode === 'AUTOMATIC';
        this.notifyService.success(automatic
          ? 'Yêu cầu đã được tự động chấp thuận. Bạn có thể liên kết ngân hàng và nhận hoàn tiền ngay.'
          : 'Đã gửi yêu cầu hủy sân đến chủ sân. Bạn có thể theo dõi tiến trình ngay trên vé.');
        this.loadBooking();
      },
      error: error => {
        this.cancelling.set(false);
        this.notifyService.error(error?.error?.message || 'Không thể gửi yêu cầu hủy sân.');
      }
    });
  }

  claimRefund(): void {
    const cancellation = this.booking()?.cancellation;
    if (!cancellation?.refundId || this.claimingRefund()) return;
    this.claimingRefund.set(true);
    this.bankAccountRepository.claimRefund(cancellation.refundId).subscribe({
      next: refund => {
        this.claimingRefund.set(false);
        if (refund.status === 'SUCCEEDED') {
          this.notifyService.success('Tiền hoàn đã được chuyển về tài khoản ngân hàng.');
        } else if (refund.status === 'PROCESSING') {
          this.notifyService.info('Lệnh hoàn tiền đã được payOS tiếp nhận và đang xử lý.');
        } else if (refund.status === 'AWAITING_BANK_ACCOUNT') {
          this.notifyService.warning(refund.failureReason || 'Vui lòng liên kết tài khoản ngân hàng để nhận hoàn tiền.');
        } else {
          this.notifyService.error(refund.failureReason || 'Lệnh hoàn tiền chưa thể thực hiện. Vui lòng thử lại sau.');
        }
        this.loadBooking();
      },
      error: error => {
        this.claimingRefund.set(false);
        if (error?.error?.error === 'BANK_ACCOUNT_REQUIRED' || error?.error?.code === 'BANK_ACCOUNT_REQUIRED') {
          void this.openBankLinking();
          return;
        }
        this.notifyService.error(error?.error?.message || 'Không thể nhận hoàn tiền lúc này.');
      }
    });
  }

  openBankLinking(): Promise<boolean> {
    return this.router.navigate(['/settings'], {
      queryParams: {
        tab: 'banking',
        reason: 'refund',
        returnUrl: `/booking/detail/${this.bookingId()}`
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
