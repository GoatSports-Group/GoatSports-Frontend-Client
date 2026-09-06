import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
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
    return this.api.createBooking(request);
  }

  getBookingById(bookingId: string): Observable<BaseResponse<Booking>> {
    return this.api.getBookingById(bookingId);
  }

  getMyBookingHistory(status?: string, page?: number, size?: number): Observable<BaseResponse<Booking[]>> {
    return this.api.getMyBookingHistory(status, page, size);
  }

  cancelBooking(bookingId: string, request: CancelBookingRequest): Observable<BaseResponse<BookingCancellation>> {
    return this.api.cancelBooking(bookingId, request);
  }

  checkIn(request: CheckInRequest): Observable<BaseResponse<Booking>> {
    return this.api.checkIn(request);
  }
}
