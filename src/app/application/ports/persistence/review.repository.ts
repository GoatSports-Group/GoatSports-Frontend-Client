import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import {
  CreatePlayerReviewRequest,
  PlayerReviewResponse
} from '@application/dto/review/review.dto';

export interface ReviewRepository {
  createReview(request: CreatePlayerReviewRequest): Observable<BaseResponse<PlayerReviewResponse>>;
}

export const REVIEW_REPOSITORY_TOKEN = new InjectionToken<ReviewRepository>('REVIEW_REPOSITORY_TOKEN');
