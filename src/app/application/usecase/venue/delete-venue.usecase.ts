import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { VenueRepository, VENUE_REPOSITORY_TOKEN } from '@application/ports/persistence/venue.repository';

@Injectable({
  providedIn: 'root'
})
export class DeleteVenueUseCase {
  constructor(
    @Inject(VENUE_REPOSITORY_TOKEN) private venueRepository: VenueRepository
  ) { }

  execute(id: string): Observable<boolean> {
    return this.venueRepository.deleteVenue(id);
  }
}
