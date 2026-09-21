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
  /** Ma tinh/thanh dung de loc, vi du "ho-chi-minh". */
  city?: string;
  /** Dong dia diem hien thi, vi du "Quan 7, TP. Ho Chi Minh". */
  location?: string;
  sportType: SportType;
  privacy: ClubPrivacy;
  approvalMode: ClubApprovalMode;
  conversationId?: string;
  active: boolean;
  winCount: number;
  lossCount: number;
  drawCount: number;
  matchCount: number;
  /** Number of tournaments the club has joined; older API responses may omit it. */
  tournamentCount?: number;
  winRate: number;
  memberCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateClubPayload {
  name: string;
  description?: string;
  logoUrl?: string;
  city?: string;
  location?: string;
  sportType: SportType;
  privacy: ClubPrivacy;
  approvalMode: ClubApprovalMode;
}

/** Tu cach thanh vien cua chinh nguoi dang dang nhap, kem thong tin CLB. */
export interface MyClubMembership {
  membershipId: string;
  role: ClubRole;
  status: ClubMemberStatus;
  joinedAt?: string;
  requestedAt?: string;
  club: ClubModel;
}

export type ClubInvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';

/** Loi moi CLB gui cho toi. */
export interface ClubInvitationModel {
  invitationId: string;
  inviteeId: string;
  invitedBy: string;
  status: ClubInvitationStatus;
  message?: string;
  createdAt?: string;
  respondedAt?: string;
  club: ClubModel;
}

export interface ClubMemberModel {
  membershipId: string;
  clubId: string;
  userId: string;
  role: ClubRole;
  status: ClubMemberStatus;
  introMessage?: string;
  requestedAt?: string;
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

export type FeePaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'WAIVED';

export interface ClubFeeModel {
  feeId: string;
  clubId: string;
  name: string;
  amount: number;
  dueDate: string;
  required: boolean;
  paidCount: number;
  memberCount: number;
  myStatus: FeePaymentStatus | null;
  myPaidAt: string | null;
}

export interface ClubFeePaymentModel {
  feePaymentId: string;
  feeId: string;
  membershipId: string;
  userId: string | null;
  amount: number;
  paymentId: string | null;
  status: FeePaymentStatus;
  paidAt: string | null;
}

export interface CreateClubFeePayload {
  name: string;
  amount: number;
  dueDate: string;
  required: boolean;
}

export interface UpdateClubPayload {
  name?: string;
  city?: string;
  location?: string;
  description?: string;
  logoUrl?: string;
  privacy?: ClubPrivacy;
  approvalMode?: ClubApprovalMode;
}
