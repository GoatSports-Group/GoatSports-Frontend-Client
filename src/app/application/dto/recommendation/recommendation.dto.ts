import { Venue } from '@domain/entity/venue';

export interface AIRecommendationRequest {
  location: string;
  budget: number;
  sportType: string;
  preferredDate: string; // YYYY-MM-DD
  preferredTime: string; // e.g. "Morning", "Afternoon", "Evening"
}

export interface AIRecommendationResult {
  venue: Venue;
  matchScore: number;
  reasons: string[];
}
