import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ReviewRepository } from '../../domain/repositories/review.repository';
import { REVIEW_REPOSITORY_TOKEN } from '../../domain/repositories/tokens';
import { Review } from '../../domain/entities/review';

@Injectable({
  providedIn: 'root'
})
export class GetAllReviewsUseCase {
  constructor(
    @Inject(REVIEW_REPOSITORY_TOKEN) private reviewRepository: ReviewRepository
  ) {}

  execute(): Observable<Review[]> {
    return this.reviewRepository.getAllReviews();
  }
}
