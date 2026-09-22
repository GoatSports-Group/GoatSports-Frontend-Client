import { Observable } from 'rxjs';
import { PageResult } from '@application/dto/base/base-response';
import {
  MyClubMembership,
  ClubInvitationModel,
  ClubPhotoModel,
  ClubActivityModel,
  ClubRecentMatchModel,
  ClubMemberModel,
  ScoutedPlayerModel,
  ClubModel,
  CreateClubActivityPayload,
  ClubRole,
  UpdateClubPayload,
  CreateClubPayload,
  SportType
} from '@domain/models/club.model';

export abstract class ClubRepositoryPort {
  abstract searchClubs(sportType?: SportType, keyword?: string, city?: string): Observable<ClubModel[]>;

  /** CLB toi dang sinh hoat, kem vai tro cua toi. */
  abstract getMyClubs(): Observable<MyClubMembership[]>;

  /** Yeu cau tham gia cua toi con dang cho duyet. */
  abstract getMyPendingRequests(): Observable<MyClubMembership[]>;

  /** Hoat dong sap toi gom tat ca CLB toi dang sinh hoat. */
  abstract getMyUpcomingActivities(limit?: number): Observable<ClubActivityModel[]>;
  abstract getMyUpcomingActivitiesPage(page: number, size: number): Observable<PageResult<ClubActivityModel>>;

  /** Loi moi vao CLB dang cho toi tra loi. */
  abstract getMyInvitations(): Observable<ClubInvitationModel[]>;

  abstract acceptInvitation(invitationId: string): Observable<ClubMemberModel>;

  abstract declineInvitation(invitationId: string): Observable<void>;

  /** Ban quan tri moi mot nguoi choi vao CLB. */
  abstract inviteMember(clubId: string, inviteeId: string, message?: string): Observable<ClubInvitationModel>;
  abstract getClubDetails(clubId: string): Observable<ClubModel>;
  abstract createClub(payload: CreateClubPayload): Observable<ClubModel>;
  abstract joinClub(clubId: string, message?: string): Observable<ClubMemberModel>;
  abstract disbandClub(clubId: string): Observable<void>;
  abstract getScoutingCandidates(clubId: string, radiusKm?: number, limit?: number)
    : Observable<ScoutedPlayerModel[]>;
  abstract transferOwnership(clubId: string, membershipId: string): Observable<ClubMemberModel>;
  abstract leaveClub(clubId: string): Observable<void>;
  abstract getMyMembership(clubId: string): Observable<ClubMemberModel | null>;
  abstract getClubMembers(clubId: string): Observable<ClubMemberModel[]>;
  abstract getClubMembersPage(clubId: string, page: number, size: number,
    status?: 'ACTIVE' | 'PENDING'): Observable<PageResult<ClubMemberModel>>;
  abstract respondMembership(clubId: string, membershipId: string, accepted: boolean): Observable<ClubMemberModel>;
  abstract getClubActivities(clubId: string): Observable<ClubActivityModel[]>;
  abstract getClubPhotosPage(clubId: string, page: number, size: number): Observable<PageResult<ClubPhotoModel>>;
  abstract addClubPhotos(clubId: string, imageKeys: string[]): Observable<ClubPhotoModel[]>;
  abstract deleteClubPhoto(clubId: string, photoId: string): Observable<void>;
  abstract getClubActivitiesPage(clubId: string, page: number, size: number): Observable<PageResult<ClubActivityModel>>;
  abstract getClubRecentMatches(clubId: string, limit?: number): Observable<ClubRecentMatchModel[]>;
  abstract getClubMatchesPage(clubId: string, page: number, size: number): Observable<PageResult<ClubRecentMatchModel>>;
  abstract createClubActivity(clubId: string, payload: CreateClubActivityPayload): Observable<ClubActivityModel>;
  abstract updateClub(clubId: string, payload: UpdateClubPayload): Observable<ClubModel>;
  abstract changeMemberRole(clubId: string, membershipId: string, role: ClubRole): Observable<ClubMemberModel>;
  abstract removeMember(clubId: string, membershipId: string, ban: boolean): Observable<void>;
  abstract updateClubActivity(clubId: string, activityId: string,
    payload: CreateClubActivityPayload): Observable<ClubActivityModel>;
  abstract deleteClubActivity(clubId: string, activityId: string): Observable<void>;
}
