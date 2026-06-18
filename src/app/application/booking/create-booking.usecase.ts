import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import { BOOKING_REPOSITORY_TOKEN } from '../../domain/repositories/tokens';
import { Booking } from '../../domain/entities/booking';

@Injectable({
  providedIn: 'root'
})
export class CreateBookingUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY_TOKEN) private bookingRepository: BookingRepository
  ) {}

  execute(bookingData: Omit<Booking, 'bookingId' | 'status' | 'createdAt'>): Observable<Booking> {
    return this.bookingRepository.createBooking(bookingData);
  }
}
