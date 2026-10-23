import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ExternalVenue, ExternalVenueDemand, ExternalVenueQuery, ExternalVenueSuggestionRequest, GeocodingResult, Venue,
  VenueSearchFilter
} from '@application/dto/venue/venue.dto';
import { BaseResponse, PageResult } from '@application/dto/base/base-response';
import { TimeSlot } from '@application/dto/booking/booking.dto';
import { API_ENDPOINTS } from '@infrastructure/config/api-endpoints';

@Injectable({
  providedIn: 'root'
})
export class VenueSearchApi {
  private http = inject(HttpClient);
  private readonly apiBase = API_ENDPOINTS.venue;

  searchVenues(filter: VenueSearchFilter): Observable<BaseResponse<PageResult<Venue>>> {
    let params = new HttpParams();
    if (filter.keyword) params = params.set('keyword', filter.keyword);
    if (filter.sportType && filter.sportType !== 'all') params = params.set('sportType', filter.sportType);
    if (filter.district) params = params.set('district', filter.district);
    if (filter.city) params = params.set('city', filter.city);
    if (filter.latitude != null) params = params.set('latitude', filter.latitude.toString());
    if (filter.longitude != null) params = params.set('longitude', filter.longitude.toString());
    if (filter.radiusKm != null) params = params.set('radiusKm', filter.radiusKm.toString());
    if (filter.northLatitude != null) params = params.set('northLatitude', filter.northLatitude.toString());
    if (filter.southLatitude != null) params = params.set('southLatitude', filter.southLatitude.toString());
    if (filter.eastLongitude != null) params = params.set('eastLongitude', filter.eastLongitude.toString());
    if (filter.westLongitude != null) params = params.set('westLongitude', filter.westLongitude.toString());
    if (filter.minPrice != null) params = params.set('minPrice', filter.minPrice.toString());
    if (filter.maxPrice != null) params = params.set('maxPrice', filter.maxPrice.toString());
    if (filter.minRating != null) params = params.set('minRating', filter.minRating.toString());
    filter.ids?.forEach(id => params = params.append('ids', id));
    if (filter.page !== undefined) params = params.set('page', filter.page.toString());
    if (filter.size !== undefined) params = params.set('size', filter.size.toString());

    return this.http.get<BaseResponse<PageResult<Venue>>>(
      `${this.apiBase}/venues`,
      { params }
    );
  }

  getVenueDetails(venueId: string): Observable<BaseResponse<Venue>> {
    return this.http.get<BaseResponse<Venue>>(
      `${this.apiBase}/venues/${venueId}`
    );
  }

  getCourtSlots(courtId: string, date: string): Observable<BaseResponse<TimeSlot[]>> {
    const params = new HttpParams().set('date', date);
    return this.http.get<BaseResponse<TimeSlot[]>>(
      `${this.apiBase}/venue-courts/${courtId}/slots`,
      { params }
    );
  }

  searchLocations(query: string): Observable<BaseResponse<GeocodingResult[]>> {
    const params = new HttpParams().set('query', query);
    return this.http.get<BaseResponse<GeocodingResult[]>>(
      `${this.apiBase}/venues/geocoding/search`,
      { params }
    );
  }

  reverseGeocode(latitude: number, longitude: number): Observable<BaseResponse<GeocodingResult>> {
    const params = new HttpParams()
      .set('latitude', latitude.toString())
      .set('longitude', longitude.toString());
    return this.http.get<BaseResponse<GeocodingResult>>(
      `${this.apiBase}/venues/geocoding/reverse`,
      { params }
    );
  }

  searchExternalVenues(query: ExternalVenueQuery): Observable<BaseResponse<ExternalVenue[]>> {
    let params = new HttpParams()
      .set('south', query.south.toString())
      .set('west', query.west.toString())
      .set('north', query.north.toString())
      .set('east', query.east.toString());
    if (query.sportType && query.sportType !== 'all') params = params.set('sportType', query.sportType);
    if (query.keyword?.trim()) params = params.set('keyword', query.keyword.trim());
    return this.http.get<BaseResponse<ExternalVenue[]>>(`${this.apiBase}/venues/external`, { params });
  }

  getExternalVenue(externalVenueId: string): Observable<BaseResponse<ExternalVenue>> {
    return this.http.get<BaseResponse<ExternalVenue>>(`${this.apiBase}/venues/external/${externalVenueId}`);
  }

  getExternalVenueDemand(externalVenueId: string): Observable<BaseResponse<ExternalVenueDemand>> {
    return this.http.get<BaseResponse<ExternalVenueDemand>>(`${this.apiBase}/venues/external/${externalVenueId}/demand`);
  }

  setExternalVenueWanted(externalVenueId: string, wanted: boolean): Observable<BaseResponse<ExternalVenueDemand>> {
    const url = `${this.apiBase}/venues/external/${externalVenueId}/want`;
    return wanted
      ? this.http.put<BaseResponse<ExternalVenueDemand>>(url, null)
      : this.http.delete<BaseResponse<ExternalVenueDemand>>(url);
  }

  suggestExternalVenue(request: ExternalVenueSuggestionRequest): Observable<BaseResponse<{ suggestionId: string }>> {
    return this.http.post<BaseResponse<{ suggestionId: string }>>(`${this.apiBase}/venues/external/suggestions`, request);
  }
}
