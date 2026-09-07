import { Observable } from 'rxjs';
import {
  ClubActivityModel,
  ClubMemberModel,
  ClubModel,
  CreateClubActivityPayload,
  CreateClubPayload,
  SportType
} from '@domain/models/club.model';

export abstract class ClubRepositoryPort {
  abstract searchClubs(sportType?: SportType, keyword?: string): Observable<ClubModel[]>;
  abstract getClubDetails(clubId: string): Observable<ClubModel>;
  abstract createClub(payload: CreateClubPayload): Observable<ClubModel>;
  abstract joinClub(clubId: string): Observable<ClubMemberModel>;
  abstract leaveClub(clubId: string): Observable<void>;
  abstract getMyMembership(clubId: string): Observable<ClubMemberModel | null>;
  abstract getClubMembers(clubId: string): Observable<ClubMemberModel[]>;
  abstract respondMembership(clubId: string, membershipId: string, accepted: boolean): Observable<ClubMemberModel>;
  abstract getClubActivities(clubId: string): Observable<ClubActivityModel[]>;
  abstract createClubActivity(clubId: string, payload: CreateClubActivityPayload): Observable<ClubActivityModel>;
}
