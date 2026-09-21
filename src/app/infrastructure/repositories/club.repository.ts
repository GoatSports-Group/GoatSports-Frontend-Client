import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { BaseResponse, PagedModelResponse } from '@application/dto/base/base-response';
import {
  ClubActivityModel, ClubFeeModel, ClubFeePaymentModel, ClubMemberModel, ClubModel, ClubRole,
  MyClubMembership, ClubInvitationModel,
  CreateClubActivityPayload, CreateClubFeePayload, CreateClubPayload, SportType, UpdateClubPayload
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
  override getClubFees(clubId: string): Observable<ClubFeeModel[]> {
    return this.http.get<BaseResponse<ClubFeeModel[]>>(`${this.baseUrl}/${clubId}/fees`)
      .pipe(map(response => response.data ?? []));
  }
  override createClubFee(clubId: string, payload: CreateClubFeePayload): Observable<ClubFeeModel> {
    return this.http.post<BaseResponse<ClubFeeModel>>(`${this.baseUrl}/${clubId}/fees`, payload)
      .pipe(map(response => response.data));
  }
  override getFeePayments(clubId: string, feeId: string): Observable<ClubFeePaymentModel[]> {
    return this.http.get<BaseResponse<ClubFeePaymentModel[]>>(`${this.baseUrl}/${clubId}/fees/${feeId}/payments`)
      .pipe(map(response => response.data ?? []));
  }
  override initiateFeePayment(clubId: string, feeId: string): Observable<ClubFeePaymentModel> {
    return this.http.post<BaseResponse<ClubFeePaymentModel>>(`${this.baseUrl}/${clubId}/fees/${feeId}/payments`, {})
      .pipe(map(response => response.data));
  }
  override waiveFee(clubId: string, feeId: string, membershipId: string): Observable<ClubFeePaymentModel> {
    return this.http.patch<BaseResponse<ClubFeePaymentModel>>(
      `${this.baseUrl}/${clubId}/fees/${feeId}/members/${membershipId}/waive`, {})
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
}
