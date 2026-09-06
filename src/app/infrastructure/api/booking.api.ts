import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Booking,
  BookingCancellation,
  CreateBookingRequest,
  CancelBookingRequest,
  CheckInRequest
} from '@application/dto/booking/booking.dto';
import { BaseResponse } from '@application/dto/base/base-response';
import { API_ENDPOINTS } from '@infrastructure/config/api-endpoints';

@Injectable({
  providedIn: 'root'
})
export class BookingApi {
  private http = inject(HttpClient);
  private readonly apiBase = API_ENDPOINTS.venue;

  createBooking(request: CreateBookingRequest): Observable<BaseResponse<Booking>> {
    return this.http.post<BaseResponse<Booking>>(
      `${this.apiBase}/bookings`,
      request
    );
  }

  getBookingById(bookingId: string): Observable<BaseResponse<Booking>> {
    return this.http.get<BaseResponse<Booking>>(
      `${this.apiBase}/bookings/${bookingId}`
    );
  }

  getMyBookingHistory(status?: string, page: number = 0, size: number = 20): Observable<BaseResponse<Booking[]>> {
    let params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    if (status && status !== 'ALL') {
      params = params.set('status', status);
    }
    return this.http.get<BaseResponse<Booking[]>>(
      `${this.apiBase}/bookings/my-history`,
      { params }
    );
  }

  cancelBooking(bookingId: string, request: CancelBookingRequest): Observable<BaseResponse<BookingCancellation>> {
    return this.http.post<BaseResponse<BookingCancellation>>(
      `${this.apiBase}/bookings/${bookingId}/cancel`,
      request
    );
  }

  checkIn(request: CheckInRequest): Observable<BaseResponse<Booking>> {
    return this.http.post<BaseResponse<Booking>>(
      `${this.apiBase}/bookings/check-in`,
      request
    );
  }
}
