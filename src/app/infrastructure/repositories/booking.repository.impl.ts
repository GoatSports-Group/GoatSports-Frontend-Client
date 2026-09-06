import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BookingRepository } from '@application/ports/persistence/booking.repository';
import { BookingApi } from '@infrastructure/api/booking.api';
import {
  Booking,
  BookingCancellation,
  CreateBookingRequest,
  CancelBookingRequest,
  CheckInRequest
} from '@application/dto/booking/booking.dto';
import { BaseResponse } from '@application/dto/base/base-response';

@Injectable({
  providedIn: 'root'
})
export class BookingRepositoryImpl implements BookingRepository {
  private api = inject(BookingApi);

  createBooking(request: CreateBookingRequest): Observable<BaseResponse<Booking>> {
    return this.api.createBooking(request).pipe(map(response => ({
      ...response,
      data: this.normalizeBooking(response.data)
    })));
  }

  getBookingById(bookingId: string): Observable<BaseResponse<Booking>> {
    return this.api.getBookingById(bookingId).pipe(map(response => ({
      ...response,
      data: this.normalizeBooking(response.data)
    })));
  }

  getMyBookingHistory(status?: string, page?: number, size?: number): Observable<BaseResponse<Booking[]>> {
    return this.api.getMyBookingHistory(status, page, size).pipe(map(response => ({
      ...response,
      data: (response.data ?? []).map(booking => this.normalizeBooking(booking))
    })));
  }

  cancelBooking(bookingId: string, request: CancelBookingRequest): Observable<BaseResponse<BookingCancellation>> {
    return this.api.cancelBooking(bookingId, request);
  }

  checkIn(request: CheckInRequest): Observable<BaseResponse<Booking>> {
    return this.api.checkIn(request).pipe(map(response => ({
      ...response,
      data: this.normalizeBooking(response.data)
    })));
  }

  private normalizeBooking(booking: Booking): Booking {
    return {
      ...booking,
      userId: booking.userId ?? booking.playerId,
      bookingDate: booking.bookingDate ?? booking.playDate ?? '',
      playDate: booking.playDate ?? booking.bookingDate
    };
  }
}
