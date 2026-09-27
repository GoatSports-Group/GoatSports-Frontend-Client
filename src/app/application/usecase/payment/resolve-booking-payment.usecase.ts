import { Inject, Injectable } from '@angular/core';
import { Observable, catchError, concatMap, last, map, of, take, takeWhile, timer } from 'rxjs';
import { Booking } from '@application/dto/booking/booking.dto';
import {
  BOOKING_REPOSITORY_TOKEN,
  BookingRepository
} from '@application/ports/persistence/booking.repository';

export type BookingPaymentOutcome =
  | { kind: 'confirmed' | 'refunded'; booking: Booking }
  | { kind: 'unresolved'; booking: Booking | null };

/** Khoản tiền này đã giữ được sân, hay về muộn (hết giờ giữ chỗ / trùng khoản) và đang được hoàn? */
export function bookingPaymentOutcome(booking: Booking | null, paymentId: string): BookingPaymentOutcome {
  if (booking && (booking.depositPaymentId === paymentId || booking.remainingPaymentId === paymentId)) {
    return { kind: 'confirmed', booking };
  }
  if (booking && booking.lateRefundPaymentId === paymentId) return { kind: 'refunded', booking };
  return { kind: 'unresolved', booking };
}

/**
 * payment SUCCEEDED chỉ nói tiền đã về. venue-service ghi nhận khoản đó vào booking qua Kafka nên hỏi lại booking
 * (1,5 giây/lần, tối đa ~18 giây) cho tới khi biết chắc được nhận hay bị hoàn.
 */
@Injectable({ providedIn: 'root' })
export class ResolveBookingPaymentUseCase {
  constructor(@Inject(BOOKING_REPOSITORY_TOKEN) private readonly bookingRepository: BookingRepository) {}

  execute(bookingId: string, paymentId: string): Observable<BookingPaymentOutcome> {
    return timer(0, 1500).pipe(
      take(12),
      concatMap(() => this.bookingRepository.getBookingById(bookingId).pipe(
        map(response => response?.data ?? null),
        catchError(() => of(null))
      )),
      map(booking => bookingPaymentOutcome(booking, paymentId)),
      takeWhile(outcome => outcome.kind === 'unresolved', true),
      last()
    );
  }
}
