import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { VenueRepository } from '../../domain/repositories/venue.repository';
import { VENUE_REPOSITORY_TOKEN } from '../../domain/repositories/tokens';

@Injectable({
  providedIn: 'root'
})
export class DeleteVenueUseCase {
  constructor(
    @Inject(VENUE_REPOSITORY_TOKEN) private venueRepository: VenueRepository
  ) {}

  execute(id: string): Observable<boolean> {
    return this.venueRepository.deleteVenue(id);
  }
}
