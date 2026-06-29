import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BookingRepository, BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/booking.repository';

@Injectable({
  providedIn: 'root'
})
export class GetStatsUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY_TOKEN) private bookingRepository: BookingRepository
  ) { }

  execute(): Observable<{ totalVenues: number; totalBookings: number; totalRevenue: number; bookingsToday: number }> {
    return this.bookingRepository.getStats();
  }
}
