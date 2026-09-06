import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Venue, VenueSearchFilter } from '@application/dto/venue/venue.dto';
import { BaseResponse, BaseListResponse } from '@application/dto/base/base-response';
import { TimeSlot } from '@application/dto/booking/booking.dto';

export interface VenueSearchRepository {
  searchVenues(filter: VenueSearchFilter): Observable<BaseResponse<BaseListResponse<Venue>>>;
  getVenueDetails(venueId: string): Observable<BaseResponse<Venue>>;
  getCourtSlots(courtId: string, date: string): Observable<BaseResponse<TimeSlot[]>>;
}

export const VENUE_SEARCH_REPOSITORY_TOKEN = new InjectionToken<VenueSearchRepository>(
  'VENUE_SEARCH_REPOSITORY_TOKEN'
);
