import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ReviewRepository, REVIEW_REPOSITORY_TOKEN } from '@application/ports/persistence/review.repository';

@Injectable({
  providedIn: 'root'
})
export class DeleteReviewUseCase {
  constructor(
    @Inject(REVIEW_REPOSITORY_TOKEN) private reviewRepository: ReviewRepository
  ) { }

  execute(id: string): Observable<boolean> {
    return this.reviewRepository.deleteReview(id);
  }
}
