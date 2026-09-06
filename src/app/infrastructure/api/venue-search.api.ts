import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Venue, VenueSearchFilter } from '@application/dto/venue/venue.dto';
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
    if (filter.latitude) params = params.set('latitude', filter.latitude.toString());
    if (filter.longitude) params = params.set('longitude', filter.longitude.toString());
    if (filter.radiusKm) params = params.set('radiusKm', filter.radiusKm.toString());
    if (filter.minPrice) params = params.set('minPrice', filter.minPrice.toString());
    if (filter.maxPrice) params = params.set('maxPrice', filter.maxPrice.toString());
    if (filter.minRating) params = params.set('minRating', filter.minRating.toString());
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
}
