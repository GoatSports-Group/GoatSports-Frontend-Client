import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { VenueFavoriteStatus } from '@application/dto/venue/venue-favorite.dto';
import { VenueFavoriteRepository } from '@application/ports/persistence/venue-favorite.repository';
import { VenueFavoriteApi } from '@infrastructure/api/venue-favorite.api';

@Injectable({ providedIn: 'root' })
export class VenueFavoriteRepositoryImpl implements VenueFavoriteRepository {
  private readonly api = inject(VenueFavoriteApi);

  getStatus(venueId: string): Observable<VenueFavoriteStatus> {
    return this.api.getStatus(venueId).pipe(map(response => response.data));
  }

  favorite(venueId: string): Observable<VenueFavoriteStatus> {
    return this.api.favorite(venueId).pipe(map(response => response.data));
  }

  unfavorite(venueId: string): Observable<VenueFavoriteStatus> {
    return this.api.unfavorite(venueId).pipe(map(response => response.data));
  }
}
