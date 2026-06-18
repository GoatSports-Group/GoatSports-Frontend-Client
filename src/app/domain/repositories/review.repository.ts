import { Observable } from 'rxjs';
import { Review } from '../entities/review';

export interface ReviewRepository {
  getReviewsByVenue(venueId: string): Observable<Review[]>;
  addReview(venueId: string, rating: number, comment: string, userFullName: string): Observable<Review>;
  deleteReview(id: string): Observable<boolean>;
  getAllReviews(): Observable<Review[]>;
}
