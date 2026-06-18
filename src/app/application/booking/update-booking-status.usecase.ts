import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import { BOOKING_REPOSITORY_TOKEN } from '../../domain/repositories/tokens';
import { BookingStatus } from '../../domain/enums/booking-status.enum';

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
