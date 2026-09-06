import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/booking.repository';
import {
  Booking,
  BookingStatus,
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_COLORS,
  PaymentMethod
} from '@application/dto/booking/booking.dto';
import { NotifyService } from '@shared/components/notify/notify.service';

@Component({
  selector: 'app-booking-detail',
  templateUrl: './booking-detail.component.html',
  styleUrls: ['./booking-detail.component.scss'],
  standalone: false
})
export class BookingDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookingRepo = inject(BOOKING_REPOSITORY_TOKEN);
  private notifyService = inject(NotifyService);

  bookingId: string = '';
  booking: Booking | null = null;
  loading = true;

  showCancelModal = false;
  cancelReason = '';
  cancelling = false;

  statusLabels = BOOKING_STATUS_LABELS;
  statusColors = BOOKING_STATUS_COLORS;

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.bookingId = params['id'];
      if (this.bookingId) {
        this.loadBooking();
      }
    });
  }

  loadBooking(): void {
    this.loading = true;
    this.bookingRepo.getBookingById(this.bookingId).subscribe({
      next: res => {
        if (res?.data) {
          this.booking = res.data;
        }
        this.loading = false;
      },
      error: err => {
        console.error('Error loading booking:', err);
        this.loading = false;
      }
    });
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  }

  canCancel(): boolean {
    return this.booking?.status === BookingStatus.CONFIRMED || this.booking?.status === BookingStatus.PENDING_PAYMENT;
  }

  openCancelModal(): void {
    this.cancelReason = '';
    this.showCancelModal = true;
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
  }

  submitCancel(): void {
    if (!this.cancelReason.trim()) {
      this.notifyService.error('Vui lòng nhập lý do hủy sân.');
      return;
    }

    this.cancelling = true;
    this.bookingRepo.cancelBooking(this.bookingId, { reason: this.cancelReason }).subscribe({
      next: res => {
        this.cancelling = false;
        this.showCancelModal = false;
        this.notifyService.success('Yêu cầu hủy sân thành công! Số tiền hoàn sẽ được đối soát theo chính sách.');
        this.loadBooking();
      },
      error: (err: any) => {
        this.cancelling = false;
        const msg = err?.error?.message || 'Có lỗi xảy ra khi yêu cầu hủy sân.';
        this.notifyService.error(msg);
      }
    });
  }
}
