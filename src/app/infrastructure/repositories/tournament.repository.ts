import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import { TournamentModel, TournamentRegistrationModel, TournamentFixtureModel, TournamentStandingModel } from '@domain/models/tournament.model';
import { API_ENDPOINTS } from '@infrastructure/config/api-endpoints';
import { BaseResponse, SpringPageResponse } from '@application/dto/base/base-response';


@Injectable({
  providedIn: 'root'
})
export class TournamentRepository extends TournamentRepositoryPort {
  private readonly baseUrl = `${API_ENDPOINTS.club}/tournaments`;

  constructor(private readonly http: HttpClient) {
    super();
  }

  override searchTournaments(sportType?: string, status?: string, keyword?: string): Observable<TournamentModel[]> {
    let params = new HttpParams();
    if (sportType) params = params.set('sportType', sportType);
    if (status) params = params.set('status', status);
    if (keyword) params = params.set('keyword', keyword);

    return this.http.get<BaseResponse<SpringPageResponse<TournamentModel>>>(`${this.baseUrl}/search`, { params }).pipe(
      map(res => res.data?.content || [])
    );
  }

  override getTournamentDetails(tournamentId: string): Observable<TournamentModel> {
    return this.http.get<BaseResponse<TournamentModel>>(`${this.baseUrl}/${tournamentId}`).pipe(
      map(res => res.data)
    );
  }

  override createTournament(data: Partial<TournamentModel>): Observable<TournamentModel> {
    return this.http.post<BaseResponse<TournamentModel>>(this.baseUrl, data).pipe(
      map(res => res.data)
    );
  }

  override registerTeam(tournamentId: string, payload: Partial<TournamentRegistrationModel>): Observable<TournamentRegistrationModel> {
    return this.http.post<BaseResponse<TournamentRegistrationModel>>(`${this.baseUrl}/${tournamentId}/register`, payload).pipe(
      map(res => res.data)
    );
  }

  override getTournamentTeams(tournamentId: string): Observable<TournamentRegistrationModel[]> {
    return this.http.get<BaseResponse<TournamentRegistrationModel[]>>(`${this.baseUrl}/${tournamentId}/teams`).pipe(
      map(res => res.data || [])
    );
  }

  override getFixtures(tournamentId: string): Observable<TournamentFixtureModel[]> {
    return this.http.get<BaseResponse<TournamentFixtureModel[]>>(`${this.baseUrl}/${tournamentId}/fixtures`).pipe(
      map(res => res.data || [])
    );
  }

  override generateFixtures(tournamentId: string, actorUserId: string): Observable<TournamentFixtureModel[]> {
    return this.http.post<BaseResponse<TournamentFixtureModel[]>>(`${this.baseUrl}/${tournamentId}/generate-fixtures`, null, { params: { actorUserId } }).pipe(
      map(res => res.data || [])
    );
  }

  override updateFixtureResult(tournamentId: string, fixtureId: string, payload: { actorUserId: string; score1: number; score2: number }): Observable<TournamentFixtureModel> {
    return this.http.put<BaseResponse<TournamentFixtureModel>>(`${this.baseUrl}/${tournamentId}/fixtures/${fixtureId}/result`, payload).pipe(
      map(res => res.data)
    );
  }

  override getStandings(tournamentId: string): Observable<TournamentStandingModel[]> {
    return this.http.get<BaseResponse<TournamentStandingModel[]>>(`${this.baseUrl}/${tournamentId}/standings`).pipe(
      map(res => res.data || [])
    );
  }
}
