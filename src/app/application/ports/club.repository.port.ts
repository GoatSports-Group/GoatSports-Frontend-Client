import { Observable } from 'rxjs';
import { ClubModel, ClubMemberModel, ClubActivityModel } from '@domain/models/club.model';

export abstract class ClubRepositoryPort {
  abstract searchClubs(sportType?: string, region?: string, keyword?: string): Observable<ClubModel[]>;
  abstract getClubDetails(clubId: string): Observable<ClubModel>;
  abstract createClub(data: Partial<ClubModel>): Observable<ClubModel>;
  abstract joinClub(clubId: string, payload: { userId: string; userName: string; userAvatar?: string; userPhone?: string; introMessage?: string }): Observable<ClubMemberModel>;
  abstract getClubMembers(clubId: string): Observable<ClubMemberModel[]>;
  abstract getClubActivities(clubId: string): Observable<ClubActivityModel[]>;
  abstract createClubActivity(clubId: string, payload: Partial<ClubActivityModel> & { creatorId: string }): Observable<ClubActivityModel>;
  abstract leaveClub(clubId: string, userId: string): Observable<void>;
}
