import { Observable } from 'rxjs';
import {
  MyClubMembership,
  ClubInvitationModel,
  ClubActivityModel,
  ClubMemberModel,
  ClubModel,
  CreateClubActivityPayload,
  ClubFeeModel,
  ClubFeePaymentModel,
  ClubRole,
  UpdateClubPayload,
  CreateClubFeePayload,
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

  /** Loi moi vao CLB dang cho toi tra loi. */
  abstract getMyInvitations(): Observable<ClubInvitationModel[]>;

  abstract acceptInvitation(invitationId: string): Observable<ClubMemberModel>;

  abstract declineInvitation(invitationId: string): Observable<void>;

  /** Ban quan tri moi mot nguoi choi vao CLB. */
  abstract inviteMember(clubId: string, inviteeId: string, message?: string): Observable<ClubInvitationModel>;
  abstract getClubDetails(clubId: string): Observable<ClubModel>;
  abstract createClub(payload: CreateClubPayload): Observable<ClubModel>;
  abstract joinClub(clubId: string): Observable<ClubMemberModel>;
  abstract leaveClub(clubId: string): Observable<void>;
  abstract getMyMembership(clubId: string): Observable<ClubMemberModel | null>;
  abstract getClubMembers(clubId: string): Observable<ClubMemberModel[]>;
  abstract respondMembership(clubId: string, membershipId: string, accepted: boolean): Observable<ClubMemberModel>;
  abstract getClubActivities(clubId: string): Observable<ClubActivityModel[]>;
  abstract createClubActivity(clubId: string, payload: CreateClubActivityPayload): Observable<ClubActivityModel>;
  abstract getClubFees(clubId: string): Observable<ClubFeeModel[]>;
  abstract createClubFee(clubId: string, payload: CreateClubFeePayload): Observable<ClubFeeModel>;
  abstract getFeePayments(clubId: string, feeId: string): Observable<ClubFeePaymentModel[]>;
  abstract initiateFeePayment(clubId: string, feeId: string): Observable<ClubFeePaymentModel>;
  abstract waiveFee(clubId: string, feeId: string, membershipId: string): Observable<ClubFeePaymentModel>;
  abstract updateClub(clubId: string, payload: UpdateClubPayload): Observable<ClubModel>;
  abstract changeMemberRole(clubId: string, membershipId: string, role: ClubRole): Observable<ClubMemberModel>;
  abstract removeMember(clubId: string, membershipId: string, ban: boolean): Observable<void>;
  abstract updateClubActivity(clubId: string, activityId: string,
    payload: CreateClubActivityPayload): Observable<ClubActivityModel>;
  abstract deleteClubActivity(clubId: string, activityId: string): Observable<void>;
}
