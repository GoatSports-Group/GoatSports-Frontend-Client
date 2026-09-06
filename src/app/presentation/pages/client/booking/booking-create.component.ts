import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/booking.repository';
import { VENUE_SEARCH_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-search.repository';
import { Venue, VenueCourt } from '@application/dto/venue/venue.dto';
import { PaymentMethod, PAYMENT_METHOD_OPTIONS } from '@application/dto/booking/booking.dto';
import { NotifyService } from '@shared/components/notify/notify.service';

@Component({
  selector: 'app-booking-create',
  templateUrl: './booking-create.component.html',
  styleUrls: ['./booking-create.component.scss'],
  standalone: false
})
export class BookingCreateComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookingRepo = inject(BOOKING_REPOSITORY_TOKEN);
  private venueSearchRepo = inject(VENUE_SEARCH_REPOSITORY_TOKEN);
  private notifyService = inject(NotifyService);

  venueId = '';
  courtId = '';
  date = '';
  startTime = '18:00:00';
  endTime = '19:00:00';
  note = '';
  selectedPaymentMethod: PaymentMethod = PaymentMethod.BANK_TRANSFER;

  paymentMethods = PAYMENT_METHOD_OPTIONS;
  venue: Venue | null = null;
  court: VenueCourt | null = null;
  loading = true;
  submitting = false;

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.venueId = params['venueId'] || '';
      this.courtId = params['courtId'] || '';
      this.date = params['date'] || new Date().toISOString().split('T')[0];
      if (params['startTime']) this.startTime = params['startTime'];
      if (params['endTime']) this.endTime = params['endTime'];

      if (this.venueId) {
        this.loadVenueAndCourt();
      } else {
        this.loading = false;
      }
    });
  }

  loadVenueAndCourt(): void {
    this.venueSearchRepo.getVenueDetails(this.venueId).subscribe({
      next: res => {
        if (res?.data) {
          this.venue = res.data;
          if (this.venue.courts) {
            this.court = this.venue.courts.find(c => c.venueCourtId === this.courtId) || null;
          }
        }
        this.loading = false;
      },
      error: err => {
        console.error('Error loading venue:', err);
        this.loading = false;
      }
    });
  }

  getDurationHours(): number {
    if (!this.startTime || !this.endTime) return 1;
    const startH = parseInt(this.startTime.split(':')[0], 10);
    const endH = parseInt(this.endTime.split(':')[0], 10);
    return Math.max(1, endH - startH);
  }

  getTotalPrice(): number {
    const pricePerHour = this.court?.pricePerHour || 100000;
    return pricePerHour * this.getDurationHours();
  }

  getDepositAmount(): number {
    return this.getTotalPrice() * 0.3;
  }

  getRemainingAmount(): number {
    return this.getTotalPrice() - this.getDepositAmount();
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  }

  confirmBooking(): void {
    if (!this.courtId) {
      this.notifyService.error('Vui lòng chọn sân con trước khi đặt.');
      return;
    }

    this.submitting = true;
    this.bookingRepo.createBooking({
      venueCourtId: this.courtId,
      bookingDate: this.date,
      startTime: this.startTime,
      endTime: this.endTime,
      paymentMethod: this.selectedPaymentMethod,
      note: this.note
    }).subscribe({
      next: res => {
        this.submitting = false;
        if (res?.data) {
          this.notifyService.success('Đặt sân thành công! Mã vé của bạn đã sẵn sàng.');
          this.router.navigate(['/booking/detail', res.data.bookingId]);
        }
      },
      error: (err: any) => {
        this.submitting = false;
        const msg = err?.error?.message || 'Có lỗi xảy ra trong quá trình đặt sân.';
        this.notifyService.error(msg);
      }
    });
  }
}
