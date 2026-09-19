import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse, SpringPageResponse } from '@application/dto/base/base-response';
import {
  ContentReport,
  CreateContentReportRequest,
  SaveSocialCommentRequest,
  SaveSocialPostRequest,
  SocialComment,
  SocialPost,
  SocialPostShare,
  UserFollowStatus
} from '@application/dto/social-feed/social-feed.dto';
import { API_ENDPOINTS } from '@infrastructure/config/api-endpoints';

@Injectable({ providedIn: 'root' })
export class SocialFeedApi {
  private readonly http = inject(HttpClient);
  private readonly postUrl = `${API_ENDPOINTS.social}/posts`;
  private readonly reportUrl = `${API_ENDPOINTS.social}/reports`;
  private readonly followUrl = `${API_ENDPOINTS.social}/follows/users`;

  getFeed(
    page: number,
    size: number,
    followingOnly = false
  ): Observable<BaseResponse<SpringPageResponse<SocialPost>>> {
    return this.http.get<BaseResponse<SpringPageResponse<SocialPost>>>(this.postUrl, {
      params: this.pageParams(page, size).set('followingOnly', followingOnly)
    });
  }

  getFollowingUserIds(): Observable<BaseResponse<string[]>> {
    return this.http.get<BaseResponse<string[]>>(`${this.followUrl}/me/following`);
  }

  followUser(userId: string): Observable<BaseResponse<UserFollowStatus>> {
    return this.http.post<BaseResponse<UserFollowStatus>>(`${this.followUrl}/${userId}`, {});
  }

  unfollowUser(userId: string): Observable<BaseResponse<UserFollowStatus>> {
    return this.http.delete<BaseResponse<UserFollowStatus>>(`${this.followUrl}/${userId}`);
  }

  createPost(request: SaveSocialPostRequest): Observable<BaseResponse<SocialPost>> {
    return this.http.post<BaseResponse<SocialPost>>(this.postUrl, request);
  }

  updatePost(postId: string, request: SaveSocialPostRequest): Observable<BaseResponse<SocialPost>> {
    return this.http.put<BaseResponse<SocialPost>>(`${this.postUrl}/${postId}`, request);
  }

  deletePost(postId: string): Observable<void> {
    return this.http.delete<void>(`${this.postUrl}/${postId}`);
  }

  getComments(postId: string, page: number, size: number): Observable<BaseResponse<SpringPageResponse<SocialComment>>> {
    return this.http.get<BaseResponse<SpringPageResponse<SocialComment>>>(`${this.postUrl}/${postId}/comments`, {
      params: this.pageParams(page, size)
    });
  }

  createComment(postId: string, request: SaveSocialCommentRequest): Observable<BaseResponse<SocialComment>> {
    return this.http.post<BaseResponse<SocialComment>>(`${this.postUrl}/${postId}/comments`, request);
  }

  updateComment(commentId: string, content: string): Observable<BaseResponse<SocialComment>> {
    return this.http.put<BaseResponse<SocialComment>>(`${this.postUrl}/comments/${commentId}`, { content });
  }

  deleteComment(commentId: string): Observable<void> {
    return this.http.delete<void>(`${this.postUrl}/comments/${commentId}`);
  }

  likePost(postId: string): Observable<BaseResponse<SocialPost>> {
    return this.http.post<BaseResponse<SocialPost>>(`${this.postUrl}/${postId}/like`, {});
  }

  unlikePost(postId: string): Observable<BaseResponse<SocialPost>> {
    return this.http.delete<BaseResponse<SocialPost>>(`${this.postUrl}/${postId}/like`);
  }

  sharePost(postId: string, caption: string): Observable<BaseResponse<SocialPostShare>> {
    return this.http.post<BaseResponse<SocialPostShare>>(`${this.postUrl}/${postId}/shares`, { caption });
  }

  reportContent(request: CreateContentReportRequest): Observable<BaseResponse<ContentReport>> {
    return this.http.post<BaseResponse<ContentReport>>(this.reportUrl, request);
  }

  private pageParams(page: number, size: number): HttpParams {
    // UI dem trang tu 1, Spring Pageable dem tu 0.
    return new HttpParams().set('page', Math.max(0, page - 1)).set('size', size);
  }
}
