import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ReviewRepository } from '../../domain/repositories/review.repository';
import { REVIEW_REPOSITORY_TOKEN } from '../../domain/repositories/tokens';

@Injectable({
  providedIn: 'root'
})
export class DeleteReviewUseCase {
  constructor(
    @Inject(REVIEW_REPOSITORY_TOKEN) private reviewRepository: ReviewRepository
  ) {}

  execute(id: string): Observable<boolean> {
    return this.reviewRepository.deleteReview(id);
  }
}
