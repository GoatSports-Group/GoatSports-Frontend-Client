import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Booking,
  BookingCancellation,
  CreateBookingRequest,
  CancelBookingRequest,
  CheckInRequest
} from '@application/dto/booking/booking.dto';
import { BaseResponse } from '@application/dto/base/base-response';

export interface BookingRepository {
  createBooking(request: CreateBookingRequest): Observable<BaseResponse<Booking>>;
  getBookingById(bookingId: string): Observable<BaseResponse<Booking>>;
  getMyBookingHistory(status?: string, page?: number, size?: number): Observable<BaseResponse<Booking[]>>;
  cancelBooking(bookingId: string, request: CancelBookingRequest): Observable<BaseResponse<BookingCancellation>>;
  checkIn(request: CheckInRequest): Observable<BaseResponse<Booking>>;
}

export const BOOKING_REPOSITORY_TOKEN = new InjectionToken<BookingRepository>(
  'BOOKING_REPOSITORY_TOKEN'
);
