import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Booking } from '@domain/entity/booking';
import { BookingStatus } from '@domain/enums/booking-status.enum';

export interface BookingRepository {
  getMyBookings(email: string): Observable<Booking[]>;
  getAllBookings(): Observable<Booking[]>;
  createBooking(bookingData: Omit<Booking, 'bookingId' | 'status' | 'createdAt'>): Observable<Booking>;
  cancelBooking(id: string): Observable<boolean>;
  updateBookingStatus(id: string, status: BookingStatus): Observable<boolean>;
  getStats(): Observable<{ totalVenues: number; totalBookings: number; totalRevenue: number; bookingsToday: number }>;
}

export const BOOKING_REPOSITORY_TOKEN = new InjectionToken<BookingRepository>('BookingRepository');
