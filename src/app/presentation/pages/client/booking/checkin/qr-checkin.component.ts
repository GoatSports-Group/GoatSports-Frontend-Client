import { Component, inject } from '@angular/core';
import { BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/booking.repository';
import { Booking } from '@application/dto/booking/booking.dto';
import { NotifyService } from '@shared/components/notify/notify.service';

@Component({
  selector: 'app-qr-checkin',
  templateUrl: './qr-checkin.component.html',
  styleUrls: ['./qr-checkin.component.scss'],
  standalone: false
})
export class QrCheckinComponent {
  private bookingRepo = inject(BOOKING_REPOSITORY_TOKEN);
  private notifyService = inject(NotifyService);

  bookingCodeInput = '';
  qrInput = '';
  checkingIn = false;
  checkedInBooking: Booking | null = null;

  performCheckIn(code?: string): void {
    const inputCode = code || this.bookingCodeInput.trim();
    if (!inputCode) {
      this.notifyService.error('Vui lòng nhập mã vé hoặc quét mã QR.');
      return;
    }

    this.checkingIn = true;
    this.checkedInBooking = null;

    const isQrPayload = inputCode.startsWith('GOATSPORTS:');

    this.bookingRepo.checkIn({
      bookingCode: isQrPayload ? undefined : inputCode,
      qrCode: isQrPayload ? inputCode : undefined
    }).subscribe({
      next: res => {
        this.checkingIn = false;
        if (res?.data) {
          this.checkedInBooking = res.data;
          this.notifyService.success('Check-in thành công! Khách đã được xác nhận vào sân.');
        }
      },
      error: (err: any) => {
        this.checkingIn = false;
        const msg = err?.error?.message || 'Không tìm thấy vé hoặc mã vé không hợp lệ.';
        this.notifyService.error(msg);
      }
    });
  }

  resetCheckIn(): void {
    this.bookingCodeInput = '';
    this.qrInput = '';
    this.checkedInBooking = null;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  }
}
