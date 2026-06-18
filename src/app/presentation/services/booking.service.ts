import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Booking } from '../../domain/entities/booking';
import { GetMyBookingsUseCase } from '../../application/booking/get-my-bookings.usecase';
import { GetAllBookingsUseCase } from '../../application/booking/get-all-bookings.usecase';
import { CreateBookingUseCase } from '../../application/booking/create-booking.usecase';
import { CancelBookingUseCase } from '../../application/booking/cancel-booking.usecase';
import { UpdateBookingStatusUseCase } from '../../application/booking/update-booking-status.usecase';
import { GetStatsUseCase } from '../../application/booking/get-stats.usecase';
import { BookingStatus } from '../../domain/enums/booking-status.enum';

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private getMyBookingsUseCase = inject(GetMyBookingsUseCase);
  private getAllBookingsUseCase = inject(GetAllBookingsUseCase);
  private createBookingUseCase = inject(CreateBookingUseCase);
  private cancelBookingUseCase = inject(CancelBookingUseCase);
  private updateBookingStatusUseCase = inject(UpdateBookingStatusUseCase);
  private getStatsUseCase = inject(GetStatsUseCase);

  getMyBookings(): Observable<Booking[]> {
    return this.getMyBookingsUseCase.execute();
  }

  getAllBookings(): Observable<Booking[]> {
    return this.getAllBookingsUseCase.execute();
  }

  createBooking(bookingData: Omit<Booking, 'bookingId' | 'status' | 'createdAt'>): Observable<Booking> {
    return this.createBookingUseCase.execute(bookingData);
  }

  cancelBooking(id: string): Observable<boolean> {
    return this.cancelBookingUseCase.execute(id);
  }

  updateBookingStatus(id: string, status: BookingStatus): Observable<boolean> {
    return this.updateBookingStatusUseCase.execute(id, status);
  }

  getStats(): Observable<{ totalVenues: number; totalBookings: number; totalRevenue: number; bookingsToday: number }> {
    return this.getStatsUseCase.execute();
  }
}
