import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { ClubModel, ClubMemberModel, ClubActivityModel } from '@domain/models/club.model';
import { environment } from '@environments/environment';


@Injectable({
  providedIn: 'root'
})
export class ClubRepository extends ClubRepositoryPort {
  private readonly baseUrl = `${environment.apiUrl || 'http://localhost:8080'}/api/v1/clubs`;

  constructor(private readonly http: HttpClient) {
    super();
  }

  override searchClubs(sportType?: string, region?: string, keyword?: string): Observable<ClubModel[]> {
    let params = new HttpParams();
    if (sportType) params = params.set('sportType', sportType);
    if (region) params = params.set('region', region);
    if (keyword) params = params.set('keyword', keyword);

    return this.http.get<any>(`${this.baseUrl}/search`, { params }).pipe(
      map(res => (res.data && res.data.content ? res.data.content : (res.data || res)))
    );
  }

  override getClubDetails(clubId: string): Observable<ClubModel> {
    return this.http.get<any>(`${this.baseUrl}/${clubId}`).pipe(
      map(res => res.data || res)
    );
  }

  override createClub(data: Partial<ClubModel>): Observable<ClubModel> {
    return this.http.post<any>(this.baseUrl, data).pipe(
      map(res => res.data || res)
    );
  }

  override joinClub(clubId: string, payload: any): Observable<ClubMemberModel> {
    return this.http.post<any>(`${this.baseUrl}/${clubId}/join`, payload).pipe(
      map(res => res.data || res)
    );
  }

  override getClubMembers(clubId: string): Observable<ClubMemberModel[]> {
    return this.http.get<any>(`${this.baseUrl}/${clubId}/members`).pipe(
      map(res => res.data || res)
    );
  }

  override getClubActivities(clubId: string): Observable<ClubActivityModel[]> {
    return this.http.get<any>(`${this.baseUrl}/${clubId}/activities`).pipe(
      map(res => res.data || res)
    );
  }

  override createClubActivity(clubId: string, payload: any): Observable<ClubActivityModel> {
    return this.http.post<any>(`${this.baseUrl}/${clubId}/activities`, payload).pipe(
      map(res => res.data || res)
    );
  }

  override leaveClub(clubId: string, userId: string): Observable<void> {
    return this.http.delete<any>(`${this.baseUrl}/${clubId}/leave`, { params: { userId } }).pipe(
      map(() => void 0)
    );
  }
}
