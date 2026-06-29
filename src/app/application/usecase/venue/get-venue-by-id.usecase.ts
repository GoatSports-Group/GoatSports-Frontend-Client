import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { VenueRepository, VENUE_REPOSITORY_TOKEN } from '@application/ports/persistence/venue.repository';
import { Venue } from '@domain/entity/venue';

@Injectable({
  providedIn: 'root'
})
export class GetVenueByIdUseCase {
  constructor(
    @Inject(VENUE_REPOSITORY_TOKEN) private venueRepository: VenueRepository
  ) { }

  execute(id: string): Observable<Venue | undefined> {
    return this.venueRepository.getVenueById(id);
  }
}
