import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import {
  CreatePlayerReviewRequest,
  PlayerReviewResponse
} from '@application/dto/review/review.dto';
import { ReviewRepository } from '@application/ports/persistence/review.repository';
import { ReviewApi } from '@infrastructure/api/review.api';

@Injectable({ providedIn: 'root' })
export class ReviewRepositoryImpl implements ReviewRepository {
  private readonly api = inject(ReviewApi);

  createReview(request: CreatePlayerReviewRequest): Observable<BaseResponse<PlayerReviewResponse>> {
    return this.api.createReview(request);
  }
}
