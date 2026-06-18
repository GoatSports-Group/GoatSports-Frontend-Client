import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { VenueRepository } from '../../domain/repositories/venue.repository';
import { VENUE_REPOSITORY_TOKEN } from '../../domain/repositories/tokens';
import { TimeSlot } from '../../domain/entities/venue';

@Injectable({
  providedIn: 'root'
})
export class GetSlotsForVenueUseCase {
  constructor(
    @Inject(VENUE_REPOSITORY_TOKEN) private venueRepository: VenueRepository
  ) {}

  execute(venueId: string, dateStr: string): Observable<TimeSlot[]> {
    return this.venueRepository.getSlotsForVenue(venueId, dateStr);
  }
}
