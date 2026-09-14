export type MatchmakingSport = 'BADMINTON' | 'FOOTBALL' | 'TENNIS' | 'PICKLEBALL' | 'BASKETBALL' | 'VOLLEYBALL';
export type MatchmakingSkill = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'PRO';
export type ParticipantType = 'PLAYER' | 'CLUB';
export type AcceptanceDecision = 'ACCEPTED' | 'REJECTED';
export type MatchSessionStatus = 'PROPOSED' | 'ACCEPTED_BY_ONE' | 'ACCEPTED' | 'VENUE_SELECTED' | 'BOOKING_PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'RESULT_PENDING' | 'COMPLETED' | 'DISPUTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
export type MatchProposalStatus = 'CREATED' | 'VENUE_SELECTED' | 'BOOKING_PENDING' | 'BOOKED' | 'CHECKED_IN' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
export type MatchmakingQueueStatus = 'MATCHED' | 'QUEUED' | 'CANCELLED' | 'EXPIRED' | 'NOT_IN_QUEUE';
export type MatchSelectionMode = 'AI' | 'MANUAL';

export interface MatchScoreBreakdown {
  eloScore: number;
  scheduleScore: number;
  distanceScore: number;
  playStyleScore: number;
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
  status: MatchProposalStatus;
  createdAt: string;
  expiresAt: string;
  selectedAt?: string;
  bookingCreatedAt?: string;
  bookedAt?: string;
  checkedInAt?: string;
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
