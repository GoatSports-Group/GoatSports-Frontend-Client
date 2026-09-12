import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse, PageResult } from '@application/dto/base/base-response';
import {
  CreatePlayerReviewRequest,
  PlayerReviewResponse,
  PublicVenueReview
} from '@application/dto/review/review.dto';
import { API_ENDPOINTS } from '@infrastructure/config/api-endpoints';

@Injectable({ providedIn: 'root' })
export class ReviewApi {
  private readonly http = inject(HttpClient);
  private readonly apiBase = API_ENDPOINTS.venue;

  createReview(request: CreatePlayerReviewRequest): Observable<BaseResponse<PlayerReviewResponse>> {
    return this.http.post<BaseResponse<PlayerReviewResponse>>(
      `${this.apiBase}/player/reviews`,
      request
    );
  }

  getVenueReviews(
    venueId: string,
    page = 0,
    size = 10
  ): Observable<BaseResponse<PageResult<PublicVenueReview>>> {
    return this.http.get<BaseResponse<PageResult<PublicVenueReview>>>(
      `${this.apiBase}/venues/${venueId}/reviews`,
      { params: { page, size } }
    );
  }
}
