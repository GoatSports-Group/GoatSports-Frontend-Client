import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  PlayerSportProfile,
  SavePlayerSportProfileRequest
} from '@application/dto/player-sport-profile/player-sport-profile.dto';
import { PlayerSportProfileRepository } from '@application/ports/persistence/player-sport-profile.repository';
import { PlayerSportProfileApi } from '@infrastructure/api/player-sport-profile.api';

@Injectable({ providedIn: 'root' })
export class PlayerSportProfileRepositoryImpl implements PlayerSportProfileRepository {
  private readonly api = inject(PlayerSportProfileApi);

  getMyProfiles(): Observable<PlayerSportProfile[]> {
    return this.api.getMyProfiles().pipe(map(response => response.data || []));
  }

  createProfile(payload: SavePlayerSportProfileRequest): Observable<PlayerSportProfile> {
    return this.api.createProfile(payload).pipe(map(response => response.data));
  }

  updateProfile(
    profileId: string,
    payload: SavePlayerSportProfileRequest
  ): Observable<PlayerSportProfile> {
    return this.api.updateProfile(profileId, payload).pipe(map(response => response.data));
  }

  deleteProfile(profileId: string): Observable<void> {
    return this.api.deleteProfile(profileId);
  }
}
