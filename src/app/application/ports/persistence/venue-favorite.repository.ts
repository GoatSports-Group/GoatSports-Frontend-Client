import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { SavedVenue, VenueFavoriteStatus } from '@application/dto/venue/venue-favorite.dto';

export interface VenueFavoriteRepository {
  getStatus(venueId: string): Observable<VenueFavoriteStatus>;
  favorite(venueId: string): Observable<VenueFavoriteStatus>;
  unfavorite(venueId: string): Observable<VenueFavoriteStatus>;
  /** San nguoi dung da luu, moi luu truoc (chi id). */
  getSaved(): Observable<SavedVenue[]>;
}

export const VENUE_FAVORITE_REPOSITORY_TOKEN = new InjectionToken<VenueFavoriteRepository>(
  'VENUE_FAVORITE_REPOSITORY_TOKEN'
);
