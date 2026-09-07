export type SportType = 'FOOTBALL' | 'BADMINTON' | 'TENNIS' | 'BASKETBALL' | 'PICKLEBALL' | 'VOLLEYBALL';
export type ClubPrivacy = 'PUBLIC' | 'PRIVATE';
export type ClubApprovalMode = 'AUTO' | 'MANUAL';
export type ClubRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type ClubMemberStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'LEFT' | 'REMOVED' | 'BANNED';

export interface ClubModel {
  clubId: string;
  ownerId: string;
  name: string;
  description?: string;
  logoUrl?: string;
  sportType: SportType;
  privacy: ClubPrivacy;
  approvalMode: ClubApprovalMode;
  conversationId?: string;
  active: boolean;
  winCount: number;
  lossCount: number;
  drawCount: number;
  matchCount: number;
  winRate: number;
  memberCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateClubPayload {
  name: string;
  description?: string;
  logoUrl?: string;
  sportType: SportType;
  privacy: ClubPrivacy;
  approvalMode: ClubApprovalMode;
}

export interface ClubMemberModel {
  membershipId: string;
  clubId: string;
  userId: string;
  role: ClubRole;
  status: ClubMemberStatus;
  joinedAt?: string;
  respondedBy?: string;
  respondedAt?: string;
}

export interface ClubActivityModel {
  activityId: string;
  clubId: string;
  title: string;
  description?: string;
  venueId?: string;
  startAt: string;
  endAt: string;
  createdBy: string;
  createdAt?: string;
}

export interface CreateClubActivityPayload {
  title: string;
  description?: string;
  venueId?: string;
  startAt: string;
  endAt: string;
}
