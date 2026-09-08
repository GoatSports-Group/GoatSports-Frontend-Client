import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  PlayerSportProfile,
  SavePlayerSportProfileRequest
} from '@application/dto/player-sport-profile/player-sport-profile.dto';

export interface PlayerSportProfileRepository {
  getMyProfiles(): Observable<PlayerSportProfile[]>;
  createProfile(payload: SavePlayerSportProfileRequest): Observable<PlayerSportProfile>;
  updateProfile(profileId: string, payload: SavePlayerSportProfileRequest): Observable<PlayerSportProfile>;
  deleteProfile(profileId: string): Observable<void>;
}

export const PLAYER_SPORT_PROFILE_REPOSITORY_TOKEN =
  new InjectionToken<PlayerSportProfileRepository>('PlayerSportProfileRepository');
