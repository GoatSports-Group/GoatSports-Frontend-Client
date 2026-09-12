import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse, PageResult } from '@application/dto/base/base-response';
import {
  CreatePlayerReviewRequest,
  PlayerReviewResponse,
  PublicVenueReview
} from '@application/dto/review/review.dto';

export interface ReviewRepository {
  createReview(request: CreatePlayerReviewRequest): Observable<BaseResponse<PlayerReviewResponse>>;
  getVenueReviews(venueId: string, page?: number, size?: number): Observable<BaseResponse<PageResult<PublicVenueReview>>>;
}

export const REVIEW_REPOSITORY_TOKEN = new InjectionToken<ReviewRepository>('REVIEW_REPOSITORY_TOKEN');
