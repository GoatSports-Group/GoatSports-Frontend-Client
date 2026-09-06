import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { ClubModel, ClubMemberModel, ClubActivityModel } from '@domain/models/club.model';
import { API_ENDPOINTS } from '@infrastructure/config/api-endpoints';
import { BaseResponse, SpringPageResponse } from '@application/dto/base/base-response';


@Injectable({
  providedIn: 'root'
})
export class ClubRepository extends ClubRepositoryPort {
  private readonly baseUrl = `${API_ENDPOINTS.club}/clubs`;

  constructor(private readonly http: HttpClient) {
    super();
  }

  override searchClubs(sportType?: string, region?: string, keyword?: string): Observable<ClubModel[]> {
    let params = new HttpParams();
    if (sportType) params = params.set('sportType', sportType);
    if (region) params = params.set('region', region);
    if (keyword) params = params.set('keyword', keyword);

    return this.http.get<BaseResponse<SpringPageResponse<ClubModel>>>(`${this.baseUrl}/search`, { params }).pipe(
      map(res => res.data?.content || [])
    );
  }

  override getClubDetails(clubId: string): Observable<ClubModel> {
    return this.http.get<BaseResponse<ClubModel>>(`${this.baseUrl}/${clubId}`).pipe(
      map(res => res.data)
    );
  }

  override createClub(data: Partial<ClubModel>): Observable<ClubModel> {
    return this.http.post<BaseResponse<ClubModel>>(this.baseUrl, data).pipe(
      map(res => res.data)
    );
  }

  override joinClub(clubId: string, payload: any): Observable<ClubMemberModel> {
    return this.http.post<BaseResponse<ClubMemberModel>>(`${this.baseUrl}/${clubId}/join`, payload).pipe(
      map(res => res.data)
    );
  }

  override getClubMembers(clubId: string): Observable<ClubMemberModel[]> {
    return this.http.get<BaseResponse<ClubMemberModel[]>>(`${this.baseUrl}/${clubId}/members`).pipe(
      map(res => res.data || [])
    );
  }

  override getClubActivities(clubId: string): Observable<ClubActivityModel[]> {
    return this.http.get<BaseResponse<ClubActivityModel[]>>(`${this.baseUrl}/${clubId}/activities`).pipe(
      map(res => res.data || [])
    );
  }

  override createClubActivity(clubId: string, payload: any): Observable<ClubActivityModel> {
    return this.http.post<BaseResponse<ClubActivityModel>>(`${this.baseUrl}/${clubId}/activities`, payload).pipe(
      map(res => res.data)
    );
  }

  override leaveClub(clubId: string, userId: string): Observable<void> {
    return this.http.delete<any>(`${this.baseUrl}/${clubId}/leave`, { params: { userId } }).pipe(
      map(() => void 0)
    );
  }
}
