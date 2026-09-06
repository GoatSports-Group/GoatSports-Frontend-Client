export interface ClubModel {
  clubId: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  coverUrl?: string;
  sportType: string;
  region?: string;
  district?: string;
  city?: string;
  ownerId: string;
  ownerName?: string;
  approvalMode: 'AUTO' | 'MANUAL';
  privacy: 'PUBLIC' | 'PRIVATE';
  membershipFee?: number;
  memberCount: number;
  maxMembers: number;
  groupChatId?: string;
  active: boolean;
  createdAt?: string;
}

export interface ClubMemberModel {
  clubMemberId: string;
  clubId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userPhone?: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'LEFT';
  introMessage?: string;
  appliedAt?: string;
  joinedAt?: string;
}

export interface ClubActivityModel {
  activityId: string;
  clubId: string;
  title: string;
  description?: string;
  venueId?: string;
  venueName?: string;
  startTime: string;
  endTime: string;
  maxParticipants?: number;
  currentParticipants?: number;
  status: string;
}
