import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Booking, BookingStatus } from '@application/dto/booking/booking.dto';
import { GetMyBookingsUseCase } from '@application/usecase/booking/get-my-bookings.usecase';
import { GetAllBookingsUseCase } from '@application/usecase/booking/get-all-bookings.usecase';
import { CreateBookingUseCase } from '@application/usecase/booking/create-booking.usecase';
import { CancelBookingUseCase } from '@application/usecase/booking/cancel-booking.usecase';
import { UpdateBookingStatusUseCase } from '@application/usecase/booking/update-booking-status.usecase';
import { GetStatsUseCase } from '@application/usecase/booking/get-stats.usecase';
import { AuthService } from '@presentation/services/auth.service';

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
  private authService = inject(AuthService);

  getMyBookings(): Observable<Booking[]> {
    const email = this.authService.currentUser?.email || '';
    return this.getMyBookingsUseCase.execute(email);
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
