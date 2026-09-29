export type MatchmakingSport = 'BADMINTON' | 'FOOTBALL' | 'TENNIS' | 'PICKLEBALL' | 'BASKETBALL' | 'VOLLEYBALL';
export type MatchmakingSkill = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'PRO';
export type ParticipantType = 'PLAYER' | 'CLUB';
export type AcceptanceDecision = 'ACCEPTED' | 'REJECTED';
export type MatchSessionStatus = 'PROPOSED' | 'ACCEPTED_BY_ONE' | 'ACCEPTED' | 'VENUE_SELECTED' | 'BOOKING_PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'RESULT_PENDING' | 'COMPLETED' | 'DISPUTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
export type MatchProposalStatus = 'CREATED' | 'VENUE_SELECTED' | 'BOOKING_PENDING' | 'BOOKED' | 'CHECKED_IN' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
export type VenueSearchStatus = 'PENDING' | 'READY' | 'NO_AVAILABILITY' | 'SERVICE_UNAVAILABLE';
export type MatchmakingQueueStatus = 'MATCHED' | 'QUEUED' | 'CANCELLED' | 'EXPIRED' | 'NOT_IN_QUEUE';
export type MatchSelectionMode = 'AI' | 'MANUAL';

export type PlayFormatOption = { value: string; label: string; helper: string; size: number };

/** Khớp mã với SportParticipationPolicy (club-service) và PLAY_FORMATS (ai-service). */
export const PLAY_FORMATS: Record<MatchmakingSport, PlayFormatOption[]> = {
  BADMINTON: [
    { value: 'BADMINTON_SINGLES', label: 'Đánh đơn', helper: 'Một đấu một', size: 1 },
    { value: 'BADMINTON_DOUBLES', label: 'Đánh đôi', helper: 'Đi cùng một người bạn', size: 2 }
  ],
  TENNIS: [
    { value: 'TENNIS_SINGLES', label: 'Đánh đơn', helper: 'Một đấu một', size: 1 },
    { value: 'TENNIS_DOUBLES', label: 'Đánh đôi', helper: 'Đi cùng một người bạn', size: 2 }
  ],
  PICKLEBALL: [
    { value: 'PICKLEBALL_SINGLES', label: 'Đánh đơn', helper: 'Một đấu một', size: 1 },
    { value: 'PICKLEBALL_DOUBLES', label: 'Đánh đôi', helper: 'Đi cùng một người bạn', size: 2 }
  ],
  FOOTBALL: [
    { value: 'FOOTBALL_5', label: 'Sân 5', helper: '5 người mỗi đội', size: 5 },
    { value: 'FOOTBALL_7', label: 'Sân 7', helper: '7 người mỗi đội', size: 7 },
    { value: 'FOOTBALL_11', label: 'Sân 11', helper: '11 người mỗi đội', size: 11 }
  ],
  BASKETBALL: [
    { value: 'BASKETBALL_3X3', label: '3x3', helper: '3 người mỗi đội', size: 3 },
    { value: 'BASKETBALL_5X5', label: '5x5', helper: '5 người mỗi đội', size: 5 }
  ],
  VOLLEYBALL: [
    { value: 'VOLLEYBALL_6', label: '6 người', helper: '6 người mỗi đội', size: 6 }
  ]
};

export function playFormatLabel(format: string | null | undefined): string {
  if (!format) return '';
  return Object.values(PLAY_FORMATS).flat().find(item => item.value === format)?.label ?? format;
}

export interface MatchScoreBreakdown {
  eloScore: number;
  skillScore: number;
  scheduleScore: number;
  distanceScore: number;
  playStyleScore: number;
  positionScore: number;
  experienceScore: number;
  totalScore: number;
  reasons: string[];
}

export interface MatchVenueOption {
  venueId: string;
  venueCourtId?: string;
  venueName: string;
  address: string;
  distanceKm: number;
  rating: number;
  minPrice?: number;
  maxPrice?: number;
  score: number;
  matchReason: string;
  suggestedCourts: string[];
  /** Giờ thi đấu: slot trống sớm nhất của sân nằm trong khung rảnh chung. */
  slotStart?: string;
  slotEnd?: string;
}

export interface MatchmakingPlayer {
  participantProfileId: string;
  participantId: string;
  participantType: ParticipantType;
  name: string;
  avatarUrl?: string;
  sportType: MatchmakingSport;
  eloRating: number;
  latitude: number;
  longitude: number;
  snapshotAt: string;
  skillLevel?: MatchmakingSkill;
  preferredPositions?: string[];
  playRadiusKm?: number;
  playStyle?: string;
  matchCount?: number;
  winRate?: number;
  activeMemberCount?: number;
  preferredFormat?: string;
  playFormat?: string;
  /** Người đưa bên này vào hàng chờ (người đặt sân nếu ghép thành kèo). */
  queuedBy?: string;
  /** Người chơi của bên này: đánh đơn 1 người, cặp đôi 2 người; CLB để trống. */
  members?: MatchSideMember[];
  /** CLB: chủ và quản lý, ai trong số này cũng thay mặt cả CLB. */
  managerIds?: string[];
}

export interface MatchSideMember {
  userId: string;
  name: string;
  eloRating: number;
  matchCount?: number;
}

export interface MatchAcceptance {
  acceptanceId: string;
  participantProfileId: string;
  decision: AcceptanceDecision;
  decidedAt: string;
}

export interface MatchProposal {
  proposalId: string;
  designatedBookerId: string;
  conversationId?: string;
  venueId?: string;
  venueCourtId?: string;
  bookingId?: string;
  venueOptions: MatchVenueOption[];
  venueSearchStatus: VenueSearchStatus;
  status: MatchProposalStatus;
  createdAt: string;
  expiresAt: string;
  selectedAt?: string;
  bookingCreatedAt?: string;
  bookedAt?: string;
  checkedInAt?: string;
  cancelReason?: string;
}

export interface MatchResultClaim {
  claimId: string;
  submittedBy: string;
  participantOneScore: number;
  participantTwoScore: number;
  winnerId?: string;
  submittedAt: string;
}

export interface MatchResult {
  participantOneScore: number;
  participantTwoScore: number;
  winnerId?: string;
  confirmedAt: string;
  eloUpdates: Record<string, number>;
  eloApplied?: boolean;
}

export interface OpponentFeedback {
  feedbackId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  fairPlayRating: number;
  comment?: string;
  createdAt: string;
}

export interface MatchmakingSessionModel {
  sessionId: string;
  sportType: MatchmakingSport;
  playDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  compatibilityScore: number;
  distanceKm: number;
  eloDifference: number;
  scoreBreakdown?: MatchScoreBreakdown;
  modelVersionId?: string;
  status: MatchSessionStatus;
  matchedAt: string;
  expiresAt: string;
  acceptedAt?: string;
  confirmedAt?: string;
  checkedInAt?: string;
  completedAt?: string;
  resultPromptSentAt?: string;
  resultDeadlineAt?: string;
  participants: MatchmakingPlayer[];
  acceptances: MatchAcceptance[];
  proposal?: MatchProposal;
  resultClaims: MatchResultClaim[];
  result?: MatchResult;
  feedback: OpponentFeedback[];
}

export interface MatchCandidate {
  participant: MatchmakingPlayer;
  scoreBreakdown: MatchScoreBreakdown;
  distanceKm: number;
  eloDifference: number;
  startTime: string;
  endTime: string;
}

export interface JoinMatchmakingQueueRequest {
  playerName: string;
  playerAvatar?: string;
  sportType: MatchmakingSport;
  skillLevel: MatchmakingSkill;
  eloRating: number;
  latitude: number;
  longitude: number;
  playDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  maxEloDifference: number;
  maxDistanceKm: number;
  preferredPositions: string[];
  playStyle: string;
  matchCount: number;
  winRate: number;
  selectionMode: MatchSelectionMode;
  playFormat?: string;
  /** Đồng đội đi cùng: đúng (số người mỗi bên - 1) người, là bạn bè hoặc cùng CLB teammateClubId. */
  partnerIds?: string[];
  teammateClubId?: string;
  /** Đại diện CLB đấu CLB (chủ / quản lý, môn đồng đội); khi đó không gửi partnerIds. */
  clubId?: string;
}

export interface MatchmakingQueueResponse {
  status: MatchmakingQueueStatus;
  message: string;
  session?: MatchmakingSessionModel;
}

export interface MatchmakingStatusResponse {
  status: MatchmakingQueueStatus | MatchSessionStatus;
  queueSize?: number;
  session?: MatchmakingSessionModel;
}

export interface MatchmakingActionResponse {
  success: boolean;
  message: string;
}

export interface VenueRecommendationModel {
  venueId: string;
  venueName: string;
  sportTypes: string[];
  address: string;
  distanceKm: number;
  rating: number;
  minPrice?: number;
  maxPrice?: number;
  score: number;
  matchReason: string;
  suggestedCourts: string[];
}

export interface ChatbotResponseModel {
  answer: string;
  suggestedActions: string[];
  recommendedVenues: VenueRecommendationModel[];
}
