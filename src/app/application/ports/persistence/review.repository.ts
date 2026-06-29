import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Review } from '@domain/entity/review';

export interface ReviewRepository {
  getReviewsByVenue(venueId: string): Observable<Review[]>;
  addReview(venueId: string, rating: number, comment: string, userFullName: string): Observable<Review>;
  deleteReview(id: string): Observable<boolean>;
  getAllReviews(): Observable<Review[]>;
}

export const REVIEW_REPOSITORY_TOKEN = new InjectionToken<ReviewRepository>('ReviewRepository');
