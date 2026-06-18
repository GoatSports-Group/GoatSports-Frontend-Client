import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { VenueRepository } from '../../domain/repositories/venue.repository';
import { VENUE_REPOSITORY_TOKEN } from '../../domain/repositories/tokens';
import { Venue } from '../../domain/entities/venue';

@Injectable({
  providedIn: 'root'
})
export class AddVenueUseCase {
  constructor(
    @Inject(VENUE_REPOSITORY_TOKEN) private venueRepository: VenueRepository
  ) {}

  execute(venue: Omit<Venue, 'venueId' | 'rating'>): Observable<Venue> {
    return this.venueRepository.addVenue(venue);
  }
}
