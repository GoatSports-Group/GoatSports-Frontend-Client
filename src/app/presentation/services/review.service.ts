import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Review } from '@application/dto/review/review.dto';
import { GetReviewsByVenueUseCase } from '@application/usecase/review/get-reviews-by-venue.usecase';
import { AddReviewUseCase } from '@application/usecase/review/add-review.usecase';
import { DeleteReviewUseCase } from '@application/usecase/review/delete-review.usecase';
import { GetAllReviewsUseCase } from '@application/usecase/review/get-all-reviews.usecase';

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private getReviewsByVenueUseCase = inject(GetReviewsByVenueUseCase);
  private addReviewUseCase = inject(AddReviewUseCase);
  private deleteReviewUseCase = inject(DeleteReviewUseCase);
  private getAllReviewsUseCase = inject(GetAllReviewsUseCase);

  getReviewsByVenue(venueId: string): Observable<Review[]> {
    return this.getReviewsByVenueUseCase.execute(venueId);
  }

  addReview(venueId: string, rating: number, comment: string, userFullName: string): Observable<Review> {
    return this.addReviewUseCase.execute(venueId, rating, comment, userFullName);
  }

  deleteReview(id: string): Observable<boolean> {
    return this.deleteReviewUseCase.execute(id);
  }

  getAllReviews(): Observable<Review[]> {
    return this.getAllReviewsUseCase.execute();
  }
}
