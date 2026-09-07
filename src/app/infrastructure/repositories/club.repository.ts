import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { BaseResponse, SpringPageResponse } from '@application/dto/base/base-response';
import {
  ClubActivityModel, ClubMemberModel, ClubModel, CreateClubActivityPayload, CreateClubPayload, SportType
} from '@domain/models/club.model';
import { API_ENDPOINTS } from '@infrastructure/config/api-endpoints';

@Injectable({ providedIn: 'root' })
export class ClubRepository extends ClubRepositoryPort {
  private readonly baseUrl = `${API_ENDPOINTS.club}/clubs`;
  constructor(private readonly http: HttpClient) { super(); }

  override searchClubs(sportType?: SportType, keyword?: string): Observable<ClubModel[]> {
    let params = new HttpParams().set('size', 20);
    if (sportType) params = params.set('sportType', sportType);
    if (keyword?.trim()) params = params.set('keyword', keyword.trim());
    return this.http.get<BaseResponse<SpringPageResponse<ClubModel>>>(`${this.baseUrl}/search`, { params })
      .pipe(map(response => response.data?.content ?? []));
  }
  override getClubDetails(clubId: string): Observable<ClubModel> {
    return this.http.get<BaseResponse<ClubModel>>(`${this.baseUrl}/${clubId}`).pipe(map(response => response.data));
  }
  override createClub(payload: CreateClubPayload): Observable<ClubModel> {
    return this.http.post<BaseResponse<ClubModel>>(this.baseUrl, payload).pipe(map(response => response.data));
  }
  override joinClub(clubId: string): Observable<ClubMemberModel> {
    return this.http.post<BaseResponse<ClubMemberModel>>(`${this.baseUrl}/${clubId}/join`, {})
      .pipe(map(response => response.data));
  }
  override leaveClub(clubId: string): Observable<void> {
    return this.http.delete(`${this.baseUrl}/${clubId}/leave`).pipe(map(() => void 0));
  }
  override getMyMembership(clubId: string): Observable<ClubMemberModel | null> {
    return this.http.get<BaseResponse<ClubMemberModel> | null>(`${this.baseUrl}/${clubId}/membership/me`, {
      observe: 'response'
    }).pipe(map((response: HttpResponse<BaseResponse<ClubMemberModel> | null>) => response.body?.data ?? null));
  }
  override getClubMembers(clubId: string): Observable<ClubMemberModel[]> {
    return this.http.get<BaseResponse<ClubMemberModel[]>>(`${this.baseUrl}/${clubId}/members`)
      .pipe(map(response => response.data ?? []));
  }
  override respondMembership(clubId: string, membershipId: string, accepted: boolean): Observable<ClubMemberModel> {
    return this.http.put<BaseResponse<ClubMemberModel>>(`${this.baseUrl}/${clubId}/members/${membershipId}/respond`, { accepted })
      .pipe(map(response => response.data));
  }
  override getClubActivities(clubId: string): Observable<ClubActivityModel[]> {
    return this.http.get<BaseResponse<ClubActivityModel[]>>(`${this.baseUrl}/${clubId}/activities`)
      .pipe(map(response => response.data ?? []));
  }
  override createClubActivity(clubId: string, payload: CreateClubActivityPayload): Observable<ClubActivityModel> {
    return this.http.post<BaseResponse<ClubActivityModel>>(`${this.baseUrl}/${clubId}/activities`, payload)
      .pipe(map(response => response.data));
  }
}
