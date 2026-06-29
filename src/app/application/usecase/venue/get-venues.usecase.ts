import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { VenueRepository, VENUE_REPOSITORY_TOKEN } from '@application/ports/persistence/venue.repository';
import { Venue } from '@domain/entity/venue';
import { VenueFilter, VenueSort } from '@application/dto/venue/venue.dto';

@Injectable({
  providedIn: 'root'
})
export class GetVenuesUseCase {
  constructor(
    @Inject(VENUE_REPOSITORY_TOKEN) private venueRepository: VenueRepository
  ) { }

  execute(filter?: VenueFilter, sort?: VenueSort): Observable<Venue[]> {
    return this.venueRepository.getVenues(filter, sort);
  }
}
