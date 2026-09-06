import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import { TournamentModel, TournamentRegistrationModel, TournamentFixtureModel, TournamentStandingModel } from '@domain/models/tournament.model';
import { environment } from '@environments/environment';


@Injectable({
  providedIn: 'root'
})
export class TournamentRepository extends TournamentRepositoryPort {
  private readonly baseUrl = `${environment.apiUrl || 'http://localhost:8080'}/api/v1/tournaments`;

  constructor(private readonly http: HttpClient) {
    super();
  }

  override searchTournaments(sportType?: string, status?: string, keyword?: string): Observable<TournamentModel[]> {
    let params = new HttpParams();
    if (sportType) params = params.set('sportType', sportType);
    if (status) params = params.set('status', status);
    if (keyword) params = params.set('keyword', keyword);

    return this.http.get<any>(`${this.baseUrl}/search`, { params }).pipe(
      map(res => (res.data && res.data.content ? res.data.content : (res.data || res)))
    );
  }

  override getTournamentDetails(tournamentId: string): Observable<TournamentModel> {
    return this.http.get<any>(`${this.baseUrl}/${tournamentId}`).pipe(
      map(res => res.data || res)
    );
  }

  override createTournament(data: Partial<TournamentModel>): Observable<TournamentModel> {
    return this.http.post<any>(this.baseUrl, data).pipe(
      map(res => res.data || res)
    );
  }

  override registerTeam(tournamentId: string, payload: Partial<TournamentRegistrationModel>): Observable<TournamentRegistrationModel> {
    return this.http.post<any>(`${this.baseUrl}/${tournamentId}/register`, payload).pipe(
      map(res => res.data || res)
    );
  }

  override getTournamentTeams(tournamentId: string): Observable<TournamentRegistrationModel[]> {
    return this.http.get<any>(`${this.baseUrl}/${tournamentId}/teams`).pipe(
      map(res => res.data || res)
    );
  }

  override getFixtures(tournamentId: string): Observable<TournamentFixtureModel[]> {
    return this.http.get<any>(`${this.baseUrl}/${tournamentId}/fixtures`).pipe(
      map(res => res.data || res)
    );
  }

  override generateFixtures(tournamentId: string, actorUserId: string): Observable<TournamentFixtureModel[]> {
    return this.http.post<any>(`${this.baseUrl}/${tournamentId}/generate-fixtures`, null, { params: { actorUserId } }).pipe(
      map(res => res.data || res)
    );
  }

  override updateFixtureResult(tournamentId: string, fixtureId: string, payload: { actorUserId: string; score1: number; score2: number }): Observable<TournamentFixtureModel> {
    return this.http.put<any>(`${this.baseUrl}/${tournamentId}/fixtures/${fixtureId}/result`, payload).pipe(
      map(res => res.data || res)
    );
  }

  override getStandings(tournamentId: string): Observable<TournamentStandingModel[]> {
    return this.http.get<any>(`${this.baseUrl}/${tournamentId}/standings`).pipe(
      map(res => res.data || res)
    );
  }
}
