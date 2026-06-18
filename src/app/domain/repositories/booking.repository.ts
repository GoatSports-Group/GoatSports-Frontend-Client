import { Observable } from 'rxjs';
import { Booking } from '../entities/booking';
import { BookingStatus } from '../enums/booking-status.enum';

export interface BookingRepository {
  getMyBookings(): Observable<Booking[]>;
  getAllBookings(): Observable<Booking[]>;
  createBooking(bookingData: Omit<Booking, 'bookingId' | 'status' | 'createdAt'>): Observable<Booking>;
  cancelBooking(id: string): Observable<boolean>;
  updateBookingStatus(id: string, status: BookingStatus): Observable<boolean>;
  getStats(): Observable<{ totalVenues: number; totalBookings: number; totalRevenue: number; bookingsToday: number }>;
}
