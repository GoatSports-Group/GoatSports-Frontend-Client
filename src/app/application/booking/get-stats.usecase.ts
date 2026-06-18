import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import { BOOKING_REPOSITORY_TOKEN } from '../../domain/repositories/tokens';

@Injectable({
  providedIn: 'root'
})
export class GetStatsUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY_TOKEN) private bookingRepository: BookingRepository
  ) {}

  execute(): Observable<{ totalVenues: number; totalBookings: number; totalRevenue: number; bookingsToday: number }> {
    return this.bookingRepository.getStats();
  }
}
