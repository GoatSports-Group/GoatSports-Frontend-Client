import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { finalize, forkJoin, take } from 'rxjs';
import { Booking, TimeSlot, TimeSlotStatus } from '@application/dto/booking/booking.dto';
import { SPORT_TYPE_OPTIONS, Venue, VenueCourt } from '@application/dto/venue/venue.dto';
import { BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/booking.repository';
import { VENUE_SEARCH_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-search.repository';
import { CreateBookingDepositCheckoutUseCase } from '@application/usecase/payment/create-booking-deposit-checkout.usecase';
import { PendingBookingPaymentService } from '@presentation/services/pending-booking-payment.service';
import { NotifyService } from '@shared/components/notify/notify.service';

@Component({
  selector: 'app-booking-create',
  templateUrl: './booking-create.component.html',
  styleUrls: ['./booking-create.component.scss'],
  standalone: false
})
export class BookingCreateComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly bookingRepository = inject(BOOKING_REPOSITORY_TOKEN);
  private readonly venueSearchRepository = inject(VENUE_SEARCH_REPOSITORY_TOKEN);
  private readonly createDepositCheckout = inject(CreateBookingDepositCheckoutUseCase);
  private readonly pendingPayment = inject(PendingBookingPaymentService);
  private readonly notifyService = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  venueId = '';
  courtId = '';
  timeSlotId = '';
  date = '';
  startTime = '';
  endTime = '';

  venue: Venue | null = null;
  court: VenueCourt | null = null;
  selectedSlot: TimeSlot | null = null;
  createdBooking: Booking | null = null;
  loading = true;
  submitting = false;
  loadError = '';
  checkoutError = '';

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.venueId = params.get('venueId') ?? '';
        this.courtId = params.get('courtId') ?? '';
        this.timeSlotId = params.get('timeSlotId') ?? '';
        this.date = params.get('date') ?? '';
        this.startTime = params.get('startTime') ?? '';
        this.endTime = params.get('endTime') ?? '';
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
      && !this.submitting;
  }

  get venueAddress(): string {
    if (!this.venue) return 'Chưa cập nhật địa chỉ';
    return this.venue.address
      || [this.venue.ward, this.venue.district, this.venue.city].filter(Boolean).join(', ')
      || 'Chưa cập nhật địa chỉ';
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
      endTime: this.endTime
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
        this.startDepositCheckout(booking);
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
          expiresAt: payment.expiresAt
        });
        window.location.assign(checkoutUrl);
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
