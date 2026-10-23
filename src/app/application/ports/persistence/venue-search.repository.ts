import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ExternalVenue, ExternalVenueDemand, ExternalVenueQuery, ExternalVenueSuggestionRequest, GeocodingResult, Venue,
  VenueSearchFilter
} from '@application/dto/venue/venue.dto';
import { BaseResponse, PageResult } from '@application/dto/base/base-response';
import { TimeSlot } from '@application/dto/booking/booking.dto';

export interface VenueSearchRepository {
  searchVenues(filter: VenueSearchFilter): Observable<BaseResponse<PageResult<Venue>>>;
  getVenueDetails(venueId: string): Observable<BaseResponse<Venue>>;
  getCourtSlots(courtId: string, date: string): Observable<BaseResponse<TimeSlot[]>>;
  searchLocations(query: string): Observable<BaseResponse<GeocodingResult[]>>;
  reverseGeocode(latitude: number, longitude: number): Observable<BaseResponse<GeocodingResult>>;
  searchExternalVenues(query: ExternalVenueQuery): Observable<BaseResponse<ExternalVenue[]>>;
  getExternalVenue(externalVenueId: string): Observable<BaseResponse<ExternalVenue>>;
  getExternalVenueDemand(externalVenueId: string): Observable<BaseResponse<ExternalVenueDemand>>;
  /** Bật / tắt "muốn đặt sân này online" (cần đăng nhập). */
  setExternalVenueWanted(externalVenueId: string, wanted: boolean): Observable<BaseResponse<ExternalVenueDemand>>;
  suggestExternalVenue(request: ExternalVenueSuggestionRequest): Observable<BaseResponse<{ suggestionId: string }>>;
}

export const VENUE_SEARCH_REPOSITORY_TOKEN = new InjectionToken<VenueSearchRepository>(
  'VENUE_SEARCH_REPOSITORY_TOKEN'
);
