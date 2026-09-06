import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { VenueSearchRepository } from '@application/ports/persistence/venue-search.repository';
import { VenueSearchApi } from '@infrastructure/api/venue-search.api';
import { Venue, VenueSearchFilter } from '@application/dto/venue/venue.dto';
import { BaseResponse, BaseListResponse } from '@application/dto/base/base-response';
import { TimeSlot } from '@application/dto/booking/booking.dto';

@Injectable({
  providedIn: 'root'
})
export class VenueSearchRepositoryImpl implements VenueSearchRepository {
  private api = inject(VenueSearchApi);

  searchVenues(filter: VenueSearchFilter): Observable<BaseResponse<BaseListResponse<Venue>>> {
    return this.api.searchVenues(filter);
  }

  getVenueDetails(venueId: string): Observable<BaseResponse<Venue>> {
    return this.api.getVenueDetails(venueId);
  }

  getCourtSlots(courtId: string, date: string): Observable<BaseResponse<TimeSlot[]>> {
    return this.api.getCourtSlots(courtId, date);
  }
}
