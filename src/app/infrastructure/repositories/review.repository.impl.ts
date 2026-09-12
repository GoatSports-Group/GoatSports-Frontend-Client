import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse, PageResult } from '@application/dto/base/base-response';
import {
  CreatePlayerReviewRequest,
  PlayerReviewResponse,
  PublicVenueReview
} from '@application/dto/review/review.dto';
import { ReviewRepository } from '@application/ports/persistence/review.repository';
import { ReviewApi } from '@infrastructure/api/review.api';

@Injectable({ providedIn: 'root' })
export class ReviewRepositoryImpl implements ReviewRepository {
  private readonly api = inject(ReviewApi);

  createReview(request: CreatePlayerReviewRequest): Observable<BaseResponse<PlayerReviewResponse>> {
    return this.api.createReview(request);
  }

  getVenueReviews(
    venueId: string,
    page = 0,
    size = 10
  ): Observable<BaseResponse<PageResult<PublicVenueReview>>> {
    return this.api.getVenueReviews(venueId, page, size);
  }
}
