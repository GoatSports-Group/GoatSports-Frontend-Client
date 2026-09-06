export interface MatchmakingPlayer {
  playerId: string;
  playerName: string;
  avatarUrl?: string;
  sport: string;
  skillLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'PRO';
  eloRating: number;
  locationLat: number;
  locationLng: number;
}

export interface MatchmakingSession {
  sessionId: string;
  player1: MatchmakingPlayer;
  player2: MatchmakingPlayer;
  sport: string;
  compatibilityScore: number;
  distanceKm: number;
  eloDiff: number;
  recommendedVenueName?: string;
  matchedAt: string;
  status: string;
}

export interface VenueRecommendation {
  venueId: string;
  venueName: string;
  sportTypes: string[];
  address: string;
  distanceKm: number;
  rating: number;
  priceRange: string;
  score: number;
  matchReason: string;
  suggestedCourts: string[];
}

export interface ChatbotResponse {
  answer: string;
  suggestedActions: string[];
  recommendedVenues: VenueRecommendation[];
}
