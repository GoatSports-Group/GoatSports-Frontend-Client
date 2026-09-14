import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { catchError, finalize, forkJoin, of, switchMap, take, takeWhile, timer } from 'rxjs';
import { Booking, TimeSlot, TimeSlotStatus } from '@application/dto/booking/booking.dto';
import { Payment, PaymentAttempt, PaymentStatus } from '@application/dto/payment/payment.dto';
import { SPORT_TYPE_OPTIONS, Venue, VenueCourt } from '@application/dto/venue/venue.dto';
import { BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/booking.repository';
import {
  PAYMENT_REPOSITORY_TOKEN,
  PaymentRepository
} from '@application/ports/persistence/payment.repository';
import { VENUE_SEARCH_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-search.repository';
import { CreateBookingDepositCheckoutUseCase } from '@application/usecase/payment/create-booking-deposit-checkout.usecase';
import { PendingBookingPaymentService } from '@presentation/services/pending-booking-payment.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { AiRepositoryPort } from '@application/ports/ai.repository.port';

export interface BookingCreateDialogData {
  venueId: string;
  courtId: string;
  timeSlotId: string;
  date: string;
  startTime: string;
  endTime: string;
  matchmakingSessionId?: string;
}

@Component({
  selector: 'app-booking-create',
  templateUrl: './booking-create.component.html',
  styleUrls: ['./booking-create.component.scss'],
  standalone: false
})
export class BookingCreateComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly bookingRepository = inject(BOOKING_REPOSITORY_TOKEN);
  private readonly paymentRepository: PaymentRepository = inject(PAYMENT_REPOSITORY_TOKEN);
  private readonly venueSearchRepository = inject(VENUE_SEARCH_REPOSITORY_TOKEN);
  private readonly createDepositCheckout = inject(CreateBookingDepositCheckoutUseCase);
  private readonly pendingPayment = inject(PendingBookingPaymentService);
  private readonly notifyService = inject(NotifyService);
  private readonly aiRepository = inject(AiRepositoryPort);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogData = inject<BookingCreateDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<BookingCreateComponent>, { optional: true });

  readonly isDialog = Boolean(this.dialogData);

  venueId = '';
  courtId = '';
  timeSlotId = '';
  date = '';
  startTime = '';
  endTime = '';
  matchmakingSessionId = '';

  venue: Venue | null = null;
  court: VenueCourt | null = null;
  selectedSlot: TimeSlot | null = null;
  createdBooking: Booking | null = null;
  loading = true;
  submitting = false;
  loadError = '';
  checkoutError = '';
  checkoutAttempt: PaymentAttempt | null = null;
  paymentStatus: PaymentStatus | null = null;
  paymentFailureReason = '';
  secondsRemaining = 0;
  cancelling = false;
  showCancelConfirmation = false;
  cancellationCompleted = false;
  private paymentExpiresAt = '';
  private countdownStarted = false;
  private pollingPaymentId = '';
  private proposalBookedSynced = false;

  ngOnInit(): void {
    if (this.dialogData) {
      this.venueId = this.dialogData.venueId;
      this.courtId = this.dialogData.courtId;
      this.timeSlotId = this.dialogData.timeSlotId;
      this.date = this.dialogData.date;
      this.startTime = this.dialogData.startTime;
      this.endTime = this.dialogData.endTime;
      this.matchmakingSessionId = this.dialogData.matchmakingSessionId ?? '';
      this.loadSelection();
      return;
    }

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.venueId = params.get('venueId') ?? '';
        this.courtId = params.get('courtId') ?? '';
        this.timeSlotId = params.get('timeSlotId') ?? '';
        this.date = params.get('date') ?? '';
        this.startTime = params.get('startTime') ?? '';
        this.endTime = params.get('endTime') ?? '';
        this.matchmakingSessionId = params.get('matchmakingSessionId') ?? '';
        this.createdBooking = null;
        this.loadSelection();
      });
  }

  loadSelection(): void {
    this.loadError = '';
    this.checkoutError = '';
    this.venue = null;
    this.court = null;
    this.selectedSlot = null;

    if (!this.venueId || !this.courtId || !this.date || !this.startTime || !this.endTime) {
      this.loadError = 'Thông tin sân hoặc khung giờ chưa đầy đủ. Vui lòng chọn lại lịch trống.';
      this.loading = false;
      return;
    }

    this.loading = true;
    forkJoin({
      venueResponse: this.venueSearchRepository.getVenueDetails(this.venueId),
      slotsResponse: this.venueSearchRepository.getCourtSlots(this.courtId, this.date)
    }).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading = false)
    ).subscribe({
      next: ({ venueResponse, slotsResponse }) => {
        const venue = venueResponse?.data ?? null;
        const court = venue?.courts?.find(item => item.venueCourtId === this.courtId && item.active) ?? null;
        const slots = slotsResponse?.data ?? [];
        const slot = slots.find(item => this.timeSlotId
          ? item.timeSlotId === this.timeSlotId
          : item.startTime === this.startTime && item.endTime === this.endTime
        ) ?? null;

        if (!venue || !court) {
          this.loadError = 'Sân đã chọn không còn hoạt động. Vui lòng chọn sân khác.';
          return;
        }
        if (!slot || slot.status !== TimeSlotStatus.AVAILABLE) {
          this.loadError = 'Khung giờ này không còn khả dụng. Vui lòng chọn khung giờ khác.';
          return;
        }

        this.venue = venue;
        this.court = court;
        this.selectedSlot = slot;
        this.timeSlotId = slot.timeSlotId;
        this.startTime = slot.startTime;
        this.endTime = slot.endTime;
      },
      error: error => {
        this.loadError = this.userMessage(error, 'Không thể kiểm tra lại khung giờ. Vui lòng thử lại.');
      }
    });
  }

  get durationHours(): number {
    const start = this.minutes(this.startTime);
    const end = this.minutes(this.endTime);
    return start == null || end == null || end <= start ? 0 : (end - start) / 60;
  }

  get totalPrice(): number {
    return this.createdBooking?.totalPrice
      ?? (this.selectedSlot?.pricePerHour ?? 0) * this.durationHours;
  }

  get depositAmount(): number {
    return this.createdBooking?.depositAmount ?? this.totalPrice * 0.3;
  }

  get remainingAmount(): number {
    return this.createdBooking?.remainingAmount ?? this.totalPrice - this.depositAmount;
  }

  get canSubmit(): boolean {
    return Boolean(this.venue && this.court && this.selectedSlot && this.depositAmount > 0)
      && !this.loading
      && !this.submitting
      && !this.checkoutAttempt;
  }

  get isAwaitingPayment(): boolean {
    return this.paymentStatus === 'CREATED' || this.paymentStatus === 'PENDING';
  }

  get hasCheckoutQr(): boolean {
    return Boolean(this.checkoutAttempt?.qrCodeContent?.startsWith('data:image/'));
  }

  get paymentCountdown(): string {
    if (this.secondsRemaining <= 0) return 'Đang kiểm tra thời hạn';
    const minutes = Math.floor(this.secondsRemaining / 60).toString().padStart(2, '0');
    const seconds = (this.secondsRemaining % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  get bookingDetailUrl(): string {
    return this.createdBooking?.bookingId
      ? `/booking/detail/${this.createdBooking.bookingId}`
      : '/booking/history';
  }

  get canCloseDialog(): boolean {
    return this.cancellationCompleted
      || this.paymentStatus === 'SUCCEEDED'
      || this.paymentStatus === 'CANCELLED'
      || this.paymentStatus === 'EXPIRED'
      || this.paymentStatus === 'FAILED';
  }

  get venueAddress(): string {
    if (!this.venue) return 'Chưa cập nhật địa chỉ';
    return this.venue.address
      || [this.venue.ward, this.venue.district, this.venue.city].filter(Boolean).join(', ')
      || 'Chưa cập nhật địa chỉ';
  }

  closeDialog(): void {
    if (!this.submitting && !this.cancelling && this.canCloseDialog) this.dialogRef?.close();
  }

  async copyPaymentAmount(): Promise<void> {
    try {
      await navigator.clipboard.writeText(String(Math.round(this.depositAmount)));
      this.notifyService.success('Đã sao chép số tiền thanh toán.');
    } catch {
      this.notifyService.warning('Không thể sao chép tự động. Vui lòng nhập đúng số tiền hiển thị.');
    }
  }

  requestCancelCheckout(): void {
    if (this.submitting || this.cancelling) return;
    if (!this.checkoutAttempt && !this.createdBooking) {
      this.cancellationCompleted = true;
      if (this.dialogRef) this.dialogRef.close('cancelled');
      else void this.router.navigate(this.venueId ? ['/venues', this.venueId] : ['/venues']);
      return;
    }
    this.showCancelConfirmation = true;
  }

  keepWaitingForPayment(): void {
    if (!this.cancelling) this.showCancelConfirmation = false;
  }

  confirmCancelPayment(): void {
    const paymentId = this.checkoutAttempt?.paymentId;
    if (this.cancelling) return;
    if (!paymentId) {
      this.cancelCreatedBooking();
      return;
    }
    this.cancelling = true;
    this.checkoutError = '';

    this.paymentRepository.cancelPayment(paymentId).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.cancelling = false)
    ).subscribe({
      next: payment => {
        this.showCancelConfirmation = false;
        this.handlePaymentUpdate(payment);
        if (payment.status === 'SUCCEEDED') {
          this.notifyService.success('Thanh toán đã được xác nhận trước khi yêu cầu hủy hoàn tất.');
          return;
        }
        if (payment.status !== 'CANCELLED' && payment.status !== 'EXPIRED') {
          this.checkoutError = payment.failureReason || 'Chưa thể xác nhận hủy giao dịch.';
          return;
        }
        this.cancellationCompleted = true;
        this.pendingPayment.clear();
        this.syncCancelledMatchmakingProposal();
        this.notifyService.info('Đã hủy thanh toán và giải phóng khung giờ.');
        if (this.dialogRef) this.dialogRef.close('cancelled');
        else void this.router.navigate(this.venueId ? ['/venues', this.venueId] : ['/venues']);
      },
      error: error => {
        this.checkoutError = this.userMessage(
          error,
          'Không thể hủy giao dịch lúc này. Vui lòng thử lại.'
        );
        this.notifyService.error(this.checkoutError);
      }
    });
  }

  get cancelConfirmationMessage(): string {
    return this.checkoutAttempt
      ? 'Mã QR sẽ bị vô hiệu hóa và khung giờ sẽ được giải phóng.'
      : 'Đơn đang giữ chỗ sẽ bị hủy và khung giờ sẽ được giải phóng.';
  }

  retryPayment(): void {
    if (this.submitting || !this.createdBooking) return;
    this.submitting = true;
    this.checkoutAttempt = null;
    this.paymentStatus = null;
    this.paymentFailureReason = '';
    this.checkoutError = '';
    this.startDepositCheckout(this.createdBooking);
  }

  get paymentStateTitle(): string {
    if (this.paymentStatus === 'EXPIRED') return 'Mã thanh toán đã hết hạn';
    if (this.paymentStatus === 'CANCELLED') return 'Thanh toán đã bị hủy';
    return 'Chưa thể hoàn tất thanh toán';
  }

  get paymentStateMessage(): string {
    if (this.paymentFailureReason) return this.paymentFailureReason;
    if (this.paymentStatus === 'EXPIRED') return 'Thời gian giữ chỗ đã kết thúc. Vui lòng chọn lại khung giờ.';
    if (this.paymentStatus === 'CANCELLED') return 'Giao dịch đã được hủy trên payOS.';
    return 'Giao dịch gặp sự cố. Bạn có thể tạo lại mã thanh toán.';
  }

  get sportLabel(): string {
    const sportType = this.court?.sportType;
    return SPORT_TYPE_OPTIONS.find(option => option.value === sportType)?.label ?? sportType ?? 'Thể thao';
  }

  confirmBooking(): void {
    if (!this.canSubmit) return;
    this.checkoutError = '';
    this.submitting = true;

    if (this.createdBooking) {
      this.startDepositCheckout(this.createdBooking);
      return;
    }

    this.bookingRepository.createBooking({
      venueCourtId: this.courtId,
      playDate: this.date,
      startTime: this.startTime,
      endTime: this.endTime,
      matchmakingSessionId: this.matchmakingSessionId || undefined
    }).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: response => {
        const booking = response?.data;
        if (!booking?.bookingId) {
          this.submitting = false;
          this.checkoutError = 'Venue Service chưa trả thông tin đơn đặt sân.';
          return;
        }
        this.createdBooking = booking;
        this.syncMatchmakingProposal(booking);
      },
      error: error => {
        this.submitting = false;
        this.checkoutError = this.userMessage(error, 'Không thể tạo đơn đặt sân. Vui lòng thử lại.');
        this.notifyService.error(this.checkoutError);
        this.loadSelection();
      }
    });
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency', currency: 'VND', maximumFractionDigits: 0
    }).format(price);
  }

  formatDate(value: string): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(new Date(`${value}T00:00:00`));
  }

  private startDepositCheckout(booking: Booking): void {
    this.createDepositCheckout.execute(booking).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: ({ payment, attempt }) => {
        const checkoutUrl = attempt.checkoutUrl?.trim();
        if (!checkoutUrl || !this.isHttpUrl(checkoutUrl)) {
          this.submitting = false;
          this.checkoutError = 'PayOS chưa trả đường dẫn thanh toán hợp lệ. Bạn có thể thử lại.';
          return;
        }
        this.pendingPayment.save({
          bookingId: booking.bookingId,
          paymentId: payment.paymentId,
          expiresAt: payment.expiresAt,
          matchmakingSessionId: this.matchmakingSessionId || undefined
        });
        this.checkoutAttempt = { ...attempt, checkoutUrl };
        this.paymentStatus = payment.status === 'CREATED' ? 'PENDING' : payment.status;
        this.submitting = false;
        this.startCountdown(payment.expiresAt);
        this.startPaymentPolling(payment.paymentId);
      },
      error: error => {
        this.submitting = false;
        this.checkoutError = this.userMessage(
          error,
          'Đơn đã được giữ chỗ nhưng chưa mở được cổng thanh toán. Vui lòng thử lại trước khi hết hạn.'
        );
        this.notifyService.error(this.checkoutError);
      }
    });
  }

  private startPaymentPolling(paymentId: string): void {
    if (this.pollingPaymentId === paymentId) return;
    this.pollingPaymentId = paymentId;

    timer(0, 2000).pipe(
      switchMap(() => this.paymentRepository.getPayment(paymentId).pipe(
        catchError(() => of(null))
      )),
      takeWhile(payment => payment == null || this.isProcessingPayment(payment.status), true),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (this.pollingPaymentId === paymentId) this.pollingPaymentId = '';
      })
    ).subscribe(payment => {
      if (payment) this.handlePaymentUpdate(payment);
    });
  }

  private handlePaymentUpdate(payment: Payment): void {
    this.paymentStatus = payment.status;
    this.paymentFailureReason = payment.failureReason ?? '';

    if (payment.status === 'SUCCEEDED') {
      this.secondsRemaining = 0;
      this.pendingPayment.clear();
      this.syncBookedMatchmakingProposal();
      return;
    }

    if (!this.isProcessingPayment(payment.status)) {
      this.secondsRemaining = 0;
    }
  }

  private startCountdown(expiresAt?: string): void {
    this.paymentExpiresAt = expiresAt ?? '';
    if (this.countdownStarted) return;
    this.countdownStarted = true;

    timer(0, 1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!this.paymentExpiresAt || !this.isAwaitingPayment) {
        this.secondsRemaining = 0;
        return;
      }
      const expiresAtMs = new Date(this.paymentExpiresAt).getTime();
      this.secondsRemaining = Number.isFinite(expiresAtMs)
        ? Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000))
        : 0;
    });
  }

  private isProcessingPayment(status: PaymentStatus): boolean {
    return status === 'CREATED' || status === 'PENDING';
  }

  private syncBookedMatchmakingProposal(): void {
    if (this.proposalBookedSynced || !this.matchmakingSessionId) return;
    this.proposalBookedSynced = true;
    this.aiRepository.updateMatchProposal(this.matchmakingSessionId, { status: 'BOOKED' })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => this.proposalBookedSynced = false });
  }

  private cancelCreatedBooking(): void {
    if (!this.createdBooking) return;
    this.cancelling = true;
    this.bookingRepository.cancelBooking(this.createdBooking.bookingId, {
      reason: 'Người dùng hủy tại màn hình thanh toán.'
    }).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.cancelling = false)
    ).subscribe({
      next: () => {
        this.cancellationCompleted = true;
        this.showCancelConfirmation = false;
        this.pendingPayment.clear();
        this.syncCancelledMatchmakingProposal();
        this.notifyService.info('Đã hủy đơn và giải phóng khung giờ.');
        if (this.dialogRef) this.dialogRef.close('cancelled');
        else void this.router.navigate(this.venueId ? ['/venues', this.venueId] : ['/venues']);
      },
      error: error => {
        this.checkoutError = this.userMessage(error, 'Không thể hủy đơn lúc này. Vui lòng thử lại.');
        this.notifyService.error(this.checkoutError);
      }
    });
  }

  private syncCancelledMatchmakingProposal(): void {
    if (!this.matchmakingSessionId) return;
    this.aiRepository.updateMatchProposal(this.matchmakingSessionId, { status: 'CANCELLED' })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => this.notifyService.warning('Thanh toán đã hủy nhưng trạng thái kèo chưa kịp đồng bộ.')
      });
  }

  private syncMatchmakingProposal(booking: Booking): void {
    if (!this.matchmakingSessionId) {
      this.startDepositCheckout(booking);
      return;
    }
    this.aiRepository.registerMatchBooking(this.matchmakingSessionId, booking.bookingId).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.startDepositCheckout(booking))
    ).subscribe({
      error: () => this.notifyService.warning('Đơn sân đã được tạo nhưng trạng thái kèo chưa kịp đồng bộ.')
    });
  }

  private minutes(value: string): number | null {
    const [hours, minutes] = value.split(':').map(Number);
    return Number.isInteger(hours) && Number.isInteger(minutes) ? hours * 60 + minutes : null;
  }

  private isHttpUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  }

  private userMessage(error: unknown, fallback: string): string {
    const response = error as { error?: { message?: unknown; error?: unknown } };
    if (typeof response?.error?.message === 'string' && response.error.message.trim()) {
      return response.error.message;
    }
    if (typeof response?.error?.error === 'string' && response.error.error.trim()) {
      return response.error.error;
    }
    return fallback;
  }
}
