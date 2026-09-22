import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { BaseResponse, PageResult, PagedModelResponse } from '@application/dto/base/base-response';
import {
  ClubActivityModel, ClubPhotoModel, ClubRecentMatchModel, ClubMemberModel, ClubModel, ClubRole,
  MyClubMembership, ClubInvitationModel,
  CreateClubActivityPayload, CreateClubPayload, SportType, UpdateClubPayload
} from '@domain/models/club.model';
import { API_ENDPOINTS } from '@infrastructure/config/api-endpoints';

@Injectable({ providedIn: 'root' })
export class ClubRepository extends ClubRepositoryPort {
  private readonly baseUrl = `${API_ENDPOINTS.club}/clubs`;
  constructor(private readonly http: HttpClient) { super(); }

  override searchClubs(sportType?: SportType, keyword?: string, city?: string): Observable<ClubModel[]> {
    let params = new HttpParams().set('size', 50);
    if (sportType) params = params.set('sportType', sportType);
    if (city) params = params.set('city', city);
    if (keyword?.trim()) params = params.set('keyword', keyword.trim());
    return this.http.get<BaseResponse<PagedModelResponse<ClubModel>>>(`${this.baseUrl}/search`, { params })
      .pipe(map(response => response.data?.content ?? []));
  }
  override getMyClubs(): Observable<MyClubMembership[]> {
    return this.http.get<BaseResponse<MyClubMembership[]>>(`${this.baseUrl}/me`)
      .pipe(map(response => response.data ?? []));
  }
  override getMyPendingRequests(): Observable<MyClubMembership[]> {
    return this.http.get<BaseResponse<MyClubMembership[]>>(`${this.baseUrl}/me/requests`)
      .pipe(map(response => response.data ?? []));
  }
  override getMyUpcomingActivities(limit = 10): Observable<ClubActivityModel[]> {
    return this.http.get<BaseResponse<ClubActivityModel[]>>(`${this.baseUrl}/me/activities`,
      { params: new HttpParams().set('limit', limit) })
      .pipe(map(response => response.data ?? []));
  }
  override getMyInvitations(): Observable<ClubInvitationModel[]> {
    return this.http.get<BaseResponse<ClubInvitationModel[]>>(`${this.baseUrl}/me/invitations`)
      .pipe(map(response => response.data ?? []));
  }
  override acceptInvitation(invitationId: string): Observable<ClubMemberModel> {
    return this.http.post<BaseResponse<ClubMemberModel>>(
      `${this.baseUrl}/invitations/${invitationId}/accept`, {})
      .pipe(map(response => response.data));
  }
  override declineInvitation(invitationId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/invitations/${invitationId}/decline`, {});
  }
  override inviteMember(clubId: string, inviteeId: string, message?: string): Observable<ClubInvitationModel> {
    return this.http.post<BaseResponse<ClubInvitationModel>>(
      `${this.baseUrl}/${clubId}/invitations`, { inviteeId, message })
      .pipe(map(response => response.data));
  }
  override getClubDetails(clubId: string): Observable<ClubModel> {
    return this.http.get<BaseResponse<ClubModel>>(`${this.baseUrl}/${clubId}`).pipe(map(response => response.data));
  }
  override createClub(payload: CreateClubPayload): Observable<ClubModel> {
    return this.http.post<BaseResponse<ClubModel>>(this.baseUrl, payload).pipe(map(response => response.data));
  }
  override joinClub(clubId: string, message?: string): Observable<ClubMemberModel> {
    return this.http.post<BaseResponse<ClubMemberModel>>(`${this.baseUrl}/${clubId}/join`, { message })
      .pipe(map(response => response.data));
  }
  override transferOwnership(clubId: string, membershipId: string): Observable<ClubMemberModel> {
    return this.http.patch<BaseResponse<ClubMemberModel>>(`${this.baseUrl}/${clubId}/owner`, {},
      { params: { membershipId } }).pipe(map(response => response.data));
  }
  override disbandClub(clubId: string): Observable<void> {
    return this.http.post(`${this.baseUrl}/${clubId}/disband`, {}).pipe(map(() => void 0));
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
  override getMyUpcomingActivitiesPage(page: number, size: number): Observable<PageResult<ClubActivityModel>> {
    return this.getPage<ClubActivityModel>(`${this.baseUrl}/me/activities/page`, page, size);
  }
  override getClubMembersPage(clubId: string, page: number, size: number,
    status: 'ACTIVE' | 'PENDING' = 'ACTIVE'): Observable<PageResult<ClubMemberModel>> {
    const params = new HttpParams().set('page', page).set('size', size).set('status', status);
    return this.http.get<BaseResponse<PagedModelResponse<ClubMemberModel>>>(
      `${this.baseUrl}/${clubId}/members/page`, { params }).pipe(map(response => {
        const data = response.data;
        return {
          items: data?.content ?? [],
          total: data?.page?.totalElements ?? 0,
          page: data?.page?.number ?? page,
          pageSize: data?.page?.size ?? size,
          totalPages: data?.page?.totalPages ?? 0
        };
      }));
  }
  override respondMembership(clubId: string, membershipId: string, accepted: boolean): Observable<ClubMemberModel> {
    return this.http.put<BaseResponse<ClubMemberModel>>(`${this.baseUrl}/${clubId}/members/${membershipId}/respond`, { accepted })
      .pipe(map(response => response.data));
  }
  override getClubActivities(clubId: string): Observable<ClubActivityModel[]> {
    return this.http.get<BaseResponse<ClubActivityModel[]>>(`${this.baseUrl}/${clubId}/activities`)
      .pipe(map(response => response.data ?? []));
  }
  override getClubPhotosPage(clubId: string, page: number, size: number): Observable<PageResult<ClubPhotoModel>> {
    return this.getPage<ClubPhotoModel>(`${this.baseUrl}/${clubId}/photos`, page, size);
  }
  override addClubPhotos(clubId: string, imageKeys: string[]): Observable<ClubPhotoModel[]> {
    return this.http.post<BaseResponse<ClubPhotoModel[]>>(`${this.baseUrl}/${clubId}/photos`, { imageKeys })
      .pipe(map(response => response.data ?? []));
  }
  override deleteClubPhoto(clubId: string, photoId: string): Observable<void> {
    return this.http.delete(`${this.baseUrl}/${clubId}/photos/${photoId}`).pipe(map(() => void 0));
  }
  override getClubActivitiesPage(clubId: string, page: number, size: number): Observable<PageResult<ClubActivityModel>> {
    return this.getPage<ClubActivityModel>(`${this.baseUrl}/${clubId}/activities/page`, page, size);
  }
  override getClubRecentMatches(clubId: string, limit = 3): Observable<ClubRecentMatchModel[]> {
    return this.http.get<BaseResponse<ClubRecentMatchModel[]>>(`${this.baseUrl}/${clubId}/matches/recent`, {
      params: new HttpParams().set('limit', limit)
    }).pipe(map(response => response.data ?? []));
  }
  override getClubMatchesPage(clubId: string, page: number, size: number): Observable<PageResult<ClubRecentMatchModel>> {
    return this.getPage<ClubRecentMatchModel>(`${this.baseUrl}/${clubId}/matches/page`, page, size);
  }
  override createClubActivity(clubId: string, payload: CreateClubActivityPayload): Observable<ClubActivityModel> {
    return this.http.post<BaseResponse<ClubActivityModel>>(`${this.baseUrl}/${clubId}/activities`, payload)
      .pipe(map(response => response.data));
  }
  override updateClub(clubId: string, payload: UpdateClubPayload): Observable<ClubModel> {
    return this.http.patch<BaseResponse<ClubModel>>(`${this.baseUrl}/${clubId}`, payload)
      .pipe(map(response => response.data));
  }
  override changeMemberRole(clubId: string, membershipId: string, role: ClubRole): Observable<ClubMemberModel> {
    return this.http.patch<BaseResponse<ClubMemberModel>>(
      `${this.baseUrl}/${clubId}/members/${membershipId}/role`, { role })
      .pipe(map(response => response.data));
  }
  override removeMember(clubId: string, membershipId: string, ban: boolean): Observable<void> {
    return this.http.delete(`${this.baseUrl}/${clubId}/members/${membershipId}`,
      { params: new HttpParams().set('ban', ban) }).pipe(map(() => void 0));
  }
  override updateClubActivity(clubId: string, activityId: string,
      payload: CreateClubActivityPayload): Observable<ClubActivityModel> {
    return this.http.put<BaseResponse<ClubActivityModel>>(
      `${this.baseUrl}/${clubId}/activities/${activityId}`, payload)
      .pipe(map(response => response.data));
  }
  override deleteClubActivity(clubId: string, activityId: string): Observable<void> {
    return this.http.delete(`${this.baseUrl}/${clubId}/activities/${activityId}`).pipe(map(() => void 0));
  }

  private getPage<T>(url: string, page: number, size: number): Observable<PageResult<T>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<BaseResponse<PagedModelResponse<T>>>(url, { params }).pipe(map(response => {
      const data = response.data;
      return {
        items: data?.content ?? [],
        total: data?.page?.totalElements ?? 0,
        page: data?.page?.number ?? page,
        pageSize: data?.page?.size ?? size,
        totalPages: data?.page?.totalPages ?? 0
      };
    }));
  }
}
