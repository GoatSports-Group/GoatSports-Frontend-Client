import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { VenueFavoriteStatus } from '@application/dto/venue/venue-favorite.dto';
import { API_ENDPOINTS } from '@infrastructure/config/api-endpoints';

@Injectable({ providedIn: 'root' })
export class VenueFavoriteApi {
  private readonly http = inject(HttpClient);
  private readonly apiBase = `${API_ENDPOINTS.social}/follows/venues`;

  getStatus(venueId: string): Observable<BaseResponse<VenueFavoriteStatus>> {
    return this.http.get<BaseResponse<VenueFavoriteStatus>>(`${this.apiBase}/${venueId}`);
  }

  favorite(venueId: string): Observable<BaseResponse<VenueFavoriteStatus>> {
    return this.http.post<BaseResponse<VenueFavoriteStatus>>(`${this.apiBase}/${venueId}`, null);
  }

  unfavorite(venueId: string): Observable<BaseResponse<VenueFavoriteStatus>> {
    return this.http.delete<BaseResponse<VenueFavoriteStatus>>(`${this.apiBase}/${venueId}`);
  }
}
