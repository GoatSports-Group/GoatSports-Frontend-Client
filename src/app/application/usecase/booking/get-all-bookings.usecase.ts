import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BookingRepository, BOOKING_REPOSITORY_TOKEN } from '@application/ports/booking.repository';
import { Booking } from '@domain/entity/booking';

@Injectable({
  providedIn: 'root'
})
export class GetAllBookingsUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY_TOKEN) private bookingRepository: BookingRepository
  ) {}

  execute(): Observable<Booking[]> {
    return this.bookingRepository.getAllBookings();
  }
}
