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
  AuthorStats,
  FeedFilter,
  FollowSuggestion,
  Mention,
  TrendingTag,
  PostVisibility,
  UserFollowStatus
} from '@application/dto/social-feed/social-feed.dto';
import { API_ENDPOINTS } from '@infrastructure/config/api-endpoints';

@Injectable({ providedIn: 'root' })
export class SocialFeedApi {
  private readonly http = inject(HttpClient);
  private readonly postUrl = `${API_ENDPOINTS.social}/posts`;
  private readonly reportUrl = `${API_ENDPOINTS.social}/reports`;
  private readonly followUrl = `${API_ENDPOINTS.social}/follows/users`;

  getFeed(page: number, size: number, filter: FeedFilter = {}): Observable<BaseResponse<SpringPageResponse<SocialPost>>> {
    let params = this.pageParams(page, size).set('followingOnly', !!filter.followingOnly);
    if (filter.sport) params = params.set('sport', filter.sport);
    if (filter.authorId) params = params.set('authorId', filter.authorId);
    if (filter.tag) params = params.set('tag', filter.tag);
    return this.http.get<BaseResponse<SpringPageResponse<SocialPost>>>(this.postUrl, { params });
  }

  getSavedPosts(page: number, size: number): Observable<BaseResponse<SpringPageResponse<SocialPost>>> {
    return this.http.get<BaseResponse<SpringPageResponse<SocialPost>>>(`${this.postUrl}/saved`, {
      params: this.pageParams(page, size)
    });
  }

  getPost(postId: string): Observable<BaseResponse<SocialPost>> {
    return this.http.get<BaseResponse<SocialPost>>(`${this.postUrl}/${postId}`);
  }

  getTrendingTags(limit: number): Observable<BaseResponse<TrendingTag[]>> {
    return this.http.get<BaseResponse<TrendingTag[]>>(`${this.postUrl}/tags/trending`, {
      params: new HttpParams().set('limit', limit)
    });
  }

  getAuthorStats(authorId: string): Observable<BaseResponse<AuthorStats>> {
    return this.http.get<BaseResponse<AuthorStats>>(`${this.postUrl}/authors/${authorId}/stats`);
  }

  getFollowStatus(userId: string): Observable<BaseResponse<UserFollowStatus>> {
    return this.http.get<BaseResponse<UserFollowStatus>>(`${this.followUrl}/${userId}`);
  }

  getFollowSuggestions(limit: number): Observable<BaseResponse<FollowSuggestion[]>> {
    return this.http.get<BaseResponse<FollowSuggestion[]>>(`${this.followUrl}/suggestions`, {
      params: new HttpParams().set('limit', limit)
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

  updateComment(commentId: string, content: string, mentions: Mention[]): Observable<BaseResponse<SocialComment>> {
    return this.http.put<BaseResponse<SocialComment>>(`${this.postUrl}/comments/${commentId}`, { content, mentions });
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

  savePost(postId: string): Observable<BaseResponse<SocialPost>> {
    return this.http.put<BaseResponse<SocialPost>>(`${this.postUrl}/${postId}/save`, {});
  }

  unsavePost(postId: string): Observable<BaseResponse<SocialPost>> {
    return this.http.delete<BaseResponse<SocialPost>>(`${this.postUrl}/${postId}/save`);
  }

  sharePost(postId: string, caption: string, visibility: PostVisibility): Observable<BaseResponse<SocialPost>> {
    return this.http.post<BaseResponse<SocialPost>>(`${this.postUrl}/${postId}/shares`, { caption, visibility });
  }

  reportContent(request: CreateContentReportRequest): Observable<BaseResponse<ContentReport>> {
    return this.http.post<BaseResponse<ContentReport>>(this.reportUrl, request);
  }

  private pageParams(page: number, size: number): HttpParams {
    // UI dem trang tu 1, Spring Pageable dem tu 0.
    return new HttpParams().set('page', Math.max(0, page - 1)).set('size', size);
  }
}
