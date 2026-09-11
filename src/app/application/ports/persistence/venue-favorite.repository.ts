import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { VenueFavoriteStatus } from '@application/dto/venue/venue-favorite.dto';

export interface VenueFavoriteRepository {
  getStatus(venueId: string): Observable<VenueFavoriteStatus>;
  favorite(venueId: string): Observable<VenueFavoriteStatus>;
  unfavorite(venueId: string): Observable<VenueFavoriteStatus>;
}

export const VENUE_FAVORITE_REPOSITORY_TOKEN = new InjectionToken<VenueFavoriteRepository>(
  'VENUE_FAVORITE_REPOSITORY_TOKEN'
);
