import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { BaseResponse, SpringPageResponse } from '@application/dto/base/base-response';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import { SportType } from '@domain/models/club.model';
import {
  CreateTournamentPayload, TournamentFixtureModel, TournamentModel, TournamentRegistrationModel,
  TournamentRegistrationPayload, TournamentStandingModel, TournamentStatus
} from '@domain/models/tournament.model';
import { API_ENDPOINTS } from '@infrastructure/config/api-endpoints';

@Injectable({ providedIn: 'root' })
export class TournamentRepository extends TournamentRepositoryPort {
  private readonly baseUrl = `${API_ENDPOINTS.club}/tournaments`;
  constructor(private readonly http: HttpClient) { super(); }

  override searchTournaments(sportType?: SportType, status?: TournamentStatus, keyword?: string): Observable<TournamentModel[]> {
    let params = new HttpParams().set('size', 20);
    if (sportType) params = params.set('sportType', sportType);
    if (status) params = params.set('status', status);
    if (keyword?.trim()) params = params.set('keyword', keyword.trim());
    return this.http.get<BaseResponse<SpringPageResponse<TournamentModel>>>(`${this.baseUrl}/search`, { params })
      .pipe(map(response => response.data?.content ?? []));
  }
  override getTournamentDetails(tournamentId: string): Observable<TournamentModel> {
    return this.http.get<BaseResponse<TournamentModel>>(`${this.baseUrl}/${tournamentId}`).pipe(map(response => response.data));
  }
  override createTournament(payload: CreateTournamentPayload): Observable<TournamentModel> {
    return this.http.post<BaseResponse<TournamentModel>>(this.baseUrl, payload).pipe(map(response => response.data));
  }
  override registerTeam(tournamentId: string, payload: TournamentRegistrationPayload): Observable<TournamentRegistrationModel> {
    return this.http.post<BaseResponse<TournamentRegistrationModel>>(`${this.baseUrl}/${tournamentId}/register`, payload)
      .pipe(map(response => response.data));
  }
  override cancelRegistration(tournamentId: string, registrationId: string): Observable<void> {
    return this.http.delete(`${this.baseUrl}/${tournamentId}/registrations/${registrationId}`).pipe(map(() => void 0));
  }
  override getTournamentTeams(tournamentId: string): Observable<TournamentRegistrationModel[]> {
    return this.http.get<BaseResponse<TournamentRegistrationModel[]>>(`${this.baseUrl}/${tournamentId}/teams`)
      .pipe(map(response => response.data ?? []));
  }
  override getFixtures(tournamentId: string): Observable<TournamentFixtureModel[]> {
    return this.http.get<BaseResponse<TournamentFixtureModel[]>>(`${this.baseUrl}/${tournamentId}/fixtures`)
      .pipe(map(response => response.data ?? []));
  }
  override generateFixtures(tournamentId: string): Observable<TournamentFixtureModel[]> {
    return this.http.post<BaseResponse<TournamentFixtureModel[]>>(`${this.baseUrl}/${tournamentId}/generate-fixtures`, {})
      .pipe(map(response => response.data ?? []));
  }
  override updateFixtureResult(tournamentId: string, fixtureId: string,
      payload: { score1: number; score2: number }): Observable<TournamentFixtureModel> {
    return this.http.put<BaseResponse<TournamentFixtureModel>>(`${this.baseUrl}/${tournamentId}/fixtures/${fixtureId}/result`, payload)
      .pipe(map(response => response.data));
  }
  override getStandings(tournamentId: string): Observable<TournamentStandingModel[]> {
    return this.http.get<BaseResponse<TournamentStandingModel[]>>(`${this.baseUrl}/${tournamentId}/standings`)
      .pipe(map(response => response.data ?? []));
  }
}
