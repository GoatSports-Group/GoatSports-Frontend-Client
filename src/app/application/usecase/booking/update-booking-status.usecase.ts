import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BookingRepository, BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/booking.repository';
import { BookingStatus } from '@domain/enums/booking-status.enum';

@Injectable({
  providedIn: 'root'
})
export class UpdateBookingStatusUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY_TOKEN) private bookingRepository: BookingRepository
  ) { }

  execute(id: string, status: BookingStatus): Observable<boolean> {
    return this.bookingRepository.updateBookingStatus(id, status);
  }
}
