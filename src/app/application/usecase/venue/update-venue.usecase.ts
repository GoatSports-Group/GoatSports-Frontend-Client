import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { VenueRepository, VENUE_REPOSITORY_TOKEN } from '@application/ports/persistence/venue.repository';
import { Venue } from '@domain/entity/venue';

@Injectable({
  providedIn: 'root'
})
export class UpdateVenueUseCase {
  constructor(
    @Inject(VENUE_REPOSITORY_TOKEN) private venueRepository: VenueRepository
  ) { }

  execute(venue: Venue): Observable<Venue> {
    return this.venueRepository.updateVenue(venue);
  }
}
