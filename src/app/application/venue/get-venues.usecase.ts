import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { VenueRepository } from '../../domain/repositories/venue.repository';
import { VENUE_REPOSITORY_TOKEN } from '../../domain/repositories/tokens';
import { Venue, VenueFilter, VenueSort } from '../../domain/entities/venue';

@Injectable({
  providedIn: 'root'
})
export class GetVenuesUseCase {
  constructor(
    @Inject(VENUE_REPOSITORY_TOKEN) private venueRepository: VenueRepository
  ) {}

  execute(filter?: VenueFilter, sort?: VenueSort): Observable<Venue[]> {
    return this.venueRepository.getVenues(filter, sort);
  }
}
