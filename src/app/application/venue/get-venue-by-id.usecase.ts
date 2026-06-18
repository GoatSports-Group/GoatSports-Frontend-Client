import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { VenueRepository } from '../../domain/repositories/venue.repository';
import { VENUE_REPOSITORY_TOKEN } from '../../domain/repositories/tokens';
import { Venue } from '../../domain/entities/venue';

@Injectable({
  providedIn: 'root'
})
export class GetVenueByIdUseCase {
  constructor(
    @Inject(VENUE_REPOSITORY_TOKEN) private venueRepository: VenueRepository
  ) {}

  execute(id: string): Observable<Venue | undefined> {
    return this.venueRepository.getVenueById(id);
  }
}
