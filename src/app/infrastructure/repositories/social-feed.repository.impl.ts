import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { SpringPageResponse } from '@application/dto/base/base-response';
import {
  ContentReport,
  CreateContentReportRequest,
  SaveSocialCommentRequest,
  SaveSocialPostRequest,
  SocialComment,
  PostSport,
  SocialPost,
  AuthorStats,
  FeedFilter,
  FollowSuggestion,
  Mention,
  TrendingTag,
  PostVisibility,
  UserFollowStatus
} from '@application/dto/social-feed/social-feed.dto';
import { SocialFeedRepository } from '@application/ports/persistence/social-feed.repository';
import { SocialFeedApi } from '@infrastructure/api/social-feed.api';

@Injectable({ providedIn: 'root' })
export class SocialFeedRepositoryImpl implements SocialFeedRepository {
  private readonly api = inject(SocialFeedApi);

  getFeed(page: number, size: number, filter: FeedFilter = {}): Observable<SpringPageResponse<SocialPost>> {
    return this.api.getFeed(page, size, filter).pipe(map(response => response.data));
  }

  getSavedPosts(page: number, size: number): Observable<SpringPageResponse<SocialPost>> {
    return this.api.getSavedPosts(page, size).pipe(map(response => response.data));
  }

  getPost(postId: string): Observable<SocialPost> {
    return this.api.getPost(postId).pipe(map(response => response.data));
  }

  getTrendingTags(limit: number): Observable<TrendingTag[]> {
    return this.api.getTrendingTags(limit).pipe(map(response => response.data ?? []));
  }

  getAuthorStats(authorId: string): Observable<AuthorStats> {
    return this.api.getAuthorStats(authorId).pipe(map(response => response.data));
  }

  getFollowStatus(userId: string): Observable<UserFollowStatus> {
    return this.api.getFollowStatus(userId).pipe(map(response => response.data));
  }

  getFollowSuggestions(limit: number): Observable<FollowSuggestion[]> {
    return this.api.getFollowSuggestions(limit).pipe(map(response => response.data ?? []));
  }

  getFollowingUserIds(): Observable<string[]> {
    return this.api.getFollowingUserIds().pipe(map(response => response.data ?? []));
  }

  followUser(userId: string): Observable<UserFollowStatus> {
    return this.api.followUser(userId).pipe(map(response => response.data));
  }

  unfollowUser(userId: string): Observable<UserFollowStatus> {
    return this.api.unfollowUser(userId).pipe(map(response => response.data));
  }

  getOpenPlayerCalls(club: boolean, limit: number, sport?: PostSport | null): Observable<SocialPost[]> {
    return this.api.getOpenPlayerCalls(club, limit, sport).pipe(map(response => response.data ?? []));
  }

  setPlayerCallFilled(postId: string, filled: boolean): Observable<SocialPost> {
    return this.api.setPlayerCallFilled(postId, filled).pipe(map(response => response.data));
  }

  createPost(request: SaveSocialPostRequest): Observable<SocialPost> {
    return this.api.createPost(request).pipe(map(response => response.data));
  }

  updatePost(postId: string, request: SaveSocialPostRequest): Observable<SocialPost> {
    return this.api.updatePost(postId, request).pipe(map(response => response.data));
  }

  deletePost(postId: string): Observable<void> {
    return this.api.deletePost(postId);
  }

  getComments(postId: string, page: number, size: number): Observable<SpringPageResponse<SocialComment>> {
    return this.api.getComments(postId, page, size).pipe(map(response => response.data));
  }

  createComment(postId: string, request: SaveSocialCommentRequest): Observable<SocialComment> {
    return this.api.createComment(postId, request).pipe(map(response => response.data));
  }

  updateComment(commentId: string, content: string, mentions: Mention[]): Observable<SocialComment> {
    return this.api.updateComment(commentId, content, mentions).pipe(map(response => response.data));
  }

  deleteComment(commentId: string): Observable<void> {
    return this.api.deleteComment(commentId);
  }

  likePost(postId: string): Observable<SocialPost> {
    return this.api.likePost(postId).pipe(map(response => response.data));
  }

  unlikePost(postId: string): Observable<SocialPost> {
    return this.api.unlikePost(postId).pipe(map(response => response.data));
  }

  savePost(postId: string): Observable<SocialPost> {
    return this.api.savePost(postId).pipe(map(response => response.data));
  }

  unsavePost(postId: string): Observable<SocialPost> {
    return this.api.unsavePost(postId).pipe(map(response => response.data));
  }

  sharePost(postId: string, caption: string, visibility: PostVisibility): Observable<SocialPost> {
    return this.api.sharePost(postId, caption, visibility).pipe(map(response => response.data));
  }

  reportContent(request: CreateContentReportRequest): Observable<ContentReport> {
    return this.api.reportContent(request).pipe(map(response => response.data));
  }
}
