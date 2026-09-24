import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { BaseResponse, PagedModelResponse, PageResult } from '@application/dto/base/base-response';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import {
  FeeCheckoutModel, MyTournamentRole, TeamInvitationModel, TeamInvitee, TournamentSearchFilter,
  TournamentEligibilityRuleModel, TournamentFixtureModel, TournamentModel, TournamentRegistrationModel,
  TournamentRegistrationPayload, TournamentReservationModel, TournamentStandingModel
} from '@domain/models/tournament.model';
import { API_ENDPOINTS } from '@infrastructure/config/api-endpoints';

@Injectable({ providedIn: 'root' })
export class TournamentRepository extends TournamentRepositoryPort {
  private readonly baseUrl = `${API_ENDPOINTS.club}/tournaments`;
  constructor(private readonly http: HttpClient) { super(); }

  override searchTournaments(filter: TournamentSearchFilter, page: number, size: number): Observable<PageResult<TournamentModel>> {
    let params = new HttpParams();
    if (filter.sportType) params = params.set('sportType', filter.sportType);
    if (filter.status) params = params.set('status', filter.status);
    if (filter.keyword?.trim()) params = params.set('keyword', filter.keyword.trim());
    return this.getPage(`${this.baseUrl}/search`, params.set('sort', filter.sort ?? 'startDate,desc'), page, size);
  }
  override getMyTournaments(role: MyTournamentRole, page: number, size: number): Observable<PageResult<TournamentModel>> {
    return this.getPage(`${this.baseUrl}/me`, new HttpParams().set('role', role).set('sort', 'startDate,desc'), page, size);
  }
  /** club-service bat one-indexed-parameters: gui page + 1, tra ve page 0-based cho UI. */
  private getPage(url: string, params: HttpParams, page: number, size: number): Observable<PageResult<TournamentModel>> {
    return this.http.get<BaseResponse<PagedModelResponse<TournamentModel>>>(url,
      { params: params.set('page', page + 1).set('size', size) }).pipe(map(response => ({
        items: response.data?.content ?? [],
        total: response.data?.page?.totalElements ?? 0,
        page,
        pageSize: response.data?.page?.size ?? size,
        totalPages: response.data?.page?.totalPages ?? 0
      })));
  }
  override getTournamentDetails(tournamentId: string): Observable<TournamentModel> {
    return this.http.get<BaseResponse<TournamentModel>>(`${this.baseUrl}/${tournamentId}`).pipe(map(response => response.data));
  }
  override registerTeam(tournamentId: string, payload: TournamentRegistrationPayload): Observable<TournamentRegistrationModel> {
    return this.http.post<BaseResponse<TournamentRegistrationModel>>(`${this.baseUrl}/${tournamentId}/register`, payload)
      .pipe(map(response => response.data));
  }
  override cancelRegistration(tournamentId: string, registrationId: string): Observable<void> {
    return this.http.delete(`${this.baseUrl}/${tournamentId}/registrations/${registrationId}`).pipe(map(() => void 0));
  }
  override getMyInvitations(): Observable<TeamInvitationModel[]> {
    return this.http.get<BaseResponse<TeamInvitationModel[]>>(`${this.baseUrl}/invitations/me`)
      .pipe(map(response => response.data ?? []));
  }
  override respondInvitation(tournamentId: string, registrationId: string, accept: boolean): Observable<TournamentRegistrationModel> {
    return this.http.post<BaseResponse<TournamentRegistrationModel>>(
      `${this.baseUrl}/${tournamentId}/registrations/${registrationId}/respond`, { accept }).pipe(map(response => response.data));
  }
  override inviteMembers(tournamentId: string, registrationId: string, members: TeamInvitee[]): Observable<TournamentRegistrationModel> {
    return this.http.post<BaseResponse<TournamentRegistrationModel>>(
      `${this.baseUrl}/${tournamentId}/registrations/${registrationId}/members`, { members }).pipe(map(response => response.data));
  }
  override removeMember(tournamentId: string, registrationId: string, playerId: string): Observable<TournamentRegistrationModel> {
    return this.http.delete<BaseResponse<TournamentRegistrationModel>>(
      `${this.baseUrl}/${tournamentId}/registrations/${registrationId}/members/${playerId}`).pipe(map(response => response.data));
  }
  override checkout(tournamentId: string, registrationId: string): Observable<FeeCheckoutModel> {
    return this.http.post<BaseResponse<FeeCheckoutModel>>(
      `${this.baseUrl}/${tournamentId}/registrations/${registrationId}/checkout`, {}).pipe(map(response => response.data));
  }
  override getTournamentTeams(tournamentId: string): Observable<TournamentRegistrationModel[]> {
    return this.http.get<BaseResponse<TournamentRegistrationModel[]>>(`${this.baseUrl}/${tournamentId}/teams`)
      .pipe(map(response => response.data ?? []));
  }
  override getFixtures(tournamentId: string): Observable<TournamentFixtureModel[]> {
    return this.http.get<BaseResponse<TournamentFixtureModel[]>>(`${this.baseUrl}/${tournamentId}/fixtures`)
      .pipe(map(response => response.data ?? []));
  }
  override getStandings(tournamentId: string): Observable<TournamentStandingModel[]> {
    return this.http.get<BaseResponse<TournamentStandingModel[]>>(`${this.baseUrl}/${tournamentId}/standings`)
      .pipe(map(response => response.data ?? []));
  }
  override getEligibilityRules(tournamentId: string): Observable<TournamentEligibilityRuleModel[]> {
    return this.http.get<BaseResponse<TournamentEligibilityRuleModel[]>>(`${this.baseUrl}/${tournamentId}/eligibility-rules`)
      .pipe(map(response => response.data ?? []));
  }
  override getReservations(tournamentId: string): Observable<TournamentReservationModel[]> {
    return this.http.get<BaseResponse<TournamentReservationModel[]>>(`${this.baseUrl}/${tournamentId}/reservations`)
      .pipe(map(response => response.data ?? []));
  }
}
