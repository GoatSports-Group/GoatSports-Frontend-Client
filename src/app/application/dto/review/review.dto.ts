import { PlayerReview } from '@domain/entities/booking';

export interface CreatePlayerReviewRequest {
  bookingId: string;
  rating: number;
  content?: string;
}

export type PlayerReviewResponse = PlayerReview;
