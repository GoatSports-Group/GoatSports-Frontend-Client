import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ReviewRepository, REVIEW_REPOSITORY_TOKEN } from '@application/ports/review.repository';
import { Review } from '@domain/entity/review';

@Injectable({
  providedIn: 'root'
})
export class GetReviewsByVenueUseCase {
  constructor(
    @Inject(REVIEW_REPOSITORY_TOKEN) private reviewRepository: ReviewRepository
  ) {}

  execute(venueId: string): Observable<Review[]> {
    return this.reviewRepository.getReviewsByVenue(venueId);
  }
}
