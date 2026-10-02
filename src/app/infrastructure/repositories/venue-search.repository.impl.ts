import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { VenueSearchRepository } from '@application/ports/persistence/venue-search.repository';
import { VenueSearchApi } from '@infrastructure/api/venue-search.api';
import { GeocodingResult, Venue, VenueSearchFilter } from '@application/dto/venue/venue.dto';
import { BaseResponse, PageResult } from '@application/dto/base/base-response';
import { TimeSlot } from '@application/dto/booking/booking.dto';

@Injectable({
  providedIn: 'root'
})
export class VenueSearchRepositoryImpl implements VenueSearchRepository {
  private api = inject(VenueSearchApi);

  searchVenues(filter: VenueSearchFilter): Observable<BaseResponse<PageResult<Venue>>> {
    return this.api.searchVenues(filter).pipe(map(response => response?.data
      ? { ...response, data: { ...response.data, items: (response.data.items ?? []).map(normalizeVenue) } }
      : response));
  }

  getVenueDetails(venueId: string): Observable<BaseResponse<Venue>> {
    return this.api.getVenueDetails(venueId).pipe(map(response => response?.data
      ? { ...response, data: normalizeVenue(response.data) }
      : response));
  }

  getCourtSlots(courtId: string, date: string): Observable<BaseResponse<TimeSlot[]>> {
    return this.api.getCourtSlots(courtId, date);
  }

  searchLocations(query: string): Observable<BaseResponse<GeocodingResult[]>> {
    return this.api.searchLocations(query);
  }

  reverseGeocode(latitude: number, longitude: number): Observable<BaseResponse<GeocodingResult>> {
    return this.api.reverseGeocode(latitude, longitude);
  }
}

/**
 * venue-service trả null cho danh sách trống (vd. sân chưa khai tiện ích). Chuẩn hóa một lần ở đây để mọi
 * template dùng `.slice/.length` an toàn; trước đây `amenities: null` làm vỡ trang chi tiết sân và mất icon.
 */
function normalizeVenue(venue: Venue): Venue {
  return {
    ...venue,
    imageUrls: venue.imageUrls ?? [],
    amenities: venue.amenities ?? [],
    sportTypes: venue.sportTypes ?? [],
    courts: venue.courts ?? []
  };
}
