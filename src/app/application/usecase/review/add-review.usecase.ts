import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ReviewRepository, REVIEW_REPOSITORY_TOKEN } from '@application/ports/persistence/review.repository';
import { Review } from '@domain/entity/review';

@Injectable({
  providedIn: 'root'
})
export class AddReviewUseCase {
  constructor(
    @Inject(REVIEW_REPOSITORY_TOKEN) private reviewRepository: ReviewRepository
  ) { }

  execute(venueId: string, rating: number, comment: string, userFullName: string): Observable<Review> {
    return this.reviewRepository.addReview(venueId, rating, comment, userFullName);
  }
}
