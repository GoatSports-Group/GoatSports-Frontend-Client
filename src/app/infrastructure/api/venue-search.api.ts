import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GeocodingResult, Venue, VenueSearchFilter } from '@application/dto/venue/venue.dto';
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
}
