import { Inject, Injectable } from '@angular/core';
import { Observable, map, switchMap, throwError } from 'rxjs';
import { Booking } from '@application/dto/booking/booking.dto';
import { BookingDepositCheckout } from '@application/dto/payment/payment.dto';
import {
  PAYMENT_REPOSITORY_TOKEN,
  PaymentRepository
} from '@application/ports/persistence/payment.repository';

@Injectable({ providedIn: 'root' })
export class CreateBookingDepositCheckoutUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY_TOKEN) private readonly paymentRepository: PaymentRepository
  ) {}

  execute(booking: Booking): Observable<BookingDepositCheckout> {
    if (!booking.bookingId || !booking.depositAmount || booking.depositAmount <= 0) {
      return throwError(() => new Error('Đơn đặt sân không có khoản cọc hợp lệ.'));
    }

    return this.paymentRepository.createPayment({
      referenceType: 'BOOKING',
      referenceId: booking.bookingId,
      purpose: 'BOOKING_DEPOSIT',
      amount: booking.depositAmount,
      currency: 'VND',
      description: `Thanh toán tiền cọc cho đơn ${booking.bookingCode}`,
      expiresAt: booking.holdExpiresAt
    }, `booking-deposit:${booking.bookingId}`).pipe(
      switchMap(payment => this.paymentRepository.createPaymentAttempt(payment.paymentId, {
        method: 'BANK_TRANSFER',
        locale: 'vn'
      }).pipe(map(attempt => ({ payment, attempt }))))
    );
  }
}
