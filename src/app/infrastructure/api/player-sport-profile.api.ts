import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import {
  PlayerSportProfile,
  SavePlayerSportProfileRequest
} from '@application/dto/player-sport-profile/player-sport-profile.dto';
import { API_ENDPOINTS } from '@infrastructure/config/api-endpoints';

@Injectable({ providedIn: 'root' })
export class PlayerSportProfileApi {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${API_ENDPOINTS.auth}/users/me/sport-profiles`;

  getMyProfiles(): Observable<BaseResponse<PlayerSportProfile[]>> {
    return this.http.get<BaseResponse<PlayerSportProfile[]>>(this.endpoint);
  }

  createProfile(payload: SavePlayerSportProfileRequest): Observable<BaseResponse<PlayerSportProfile>> {
    return this.http.post<BaseResponse<PlayerSportProfile>>(this.endpoint, payload);
  }

  updateProfile(
    profileId: string,
    payload: SavePlayerSportProfileRequest
  ): Observable<BaseResponse<PlayerSportProfile>> {
    return this.http.put<BaseResponse<PlayerSportProfile>>(`${this.endpoint}/${profileId}`, payload);
  }

  deleteProfile(profileId: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint}/${profileId}`);
  }
}
