import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { SpringPageResponse } from '@application/dto/base/base-response';
import {
  ContentReport,
  CreateContentReportRequest,
  SaveSocialCommentRequest,
  SaveSocialPostRequest,
  SocialComment,
  SocialPost,
  PostSport,
  PostVisibility,
  AuthorStats,
  FeedFilter,
  FollowSuggestion,
  Mention,
  TrendingTag,
  UserFollowStatus
} from '@application/dto/social-feed/social-feed.dto';

export interface SocialFeedRepository {
  getFeed(page: number, size: number, filter?: FeedFilter): Observable<SpringPageResponse<SocialPost>>;
  getSavedPosts(page: number, size: number): Observable<SpringPageResponse<SocialPost>>;
  getPost(postId: string): Observable<SocialPost>;
  getAuthorStats(authorId: string): Observable<AuthorStats>;
  getFollowStatus(userId: string): Observable<UserFollowStatus>;
  /** Uu tien nguoi dang bai cac mon `sports` cua nguoi xem. */
  getFollowSuggestions(limit: number, sports?: readonly PostSport[]): Observable<FollowSuggestion[]>;
  /** Chu de noi bat 7 ngay; `sports` (mon dang loc / mon cua toi) dung truoc. */
  getTrendingTags(limit: number, sports?: readonly PostSport[]): Observable<TrendingTag[]>;
  /** Chu de hay dung 30 ngay, cho goi y khi go "#". */
  getTagSuggestions(limit: number): Observable<TrendingTag[]>;
  getFollowingUserIds(): Observable<string[]>;
  followUser(userId: string): Observable<UserFollowStatus>;
  unfollowUser(userId: string): Observable<UserFollowStatus>;
  createPost(request: SaveSocialPostRequest): Observable<SocialPost>;
  updatePost(postId: string, request: SaveSocialPostRequest): Observable<SocialPost>;
  deletePost(postId: string): Observable<void>;
  getComments(postId: string, page: number, size: number): Observable<SpringPageResponse<SocialComment>>;
  createComment(postId: string, request: SaveSocialCommentRequest): Observable<SocialComment>;
  updateComment(commentId: string, content: string, mentions: Mention[]): Observable<SocialComment>;
  deleteComment(commentId: string): Observable<void>;
  likePost(postId: string): Observable<SocialPost>;
  unlikePost(postId: string): Observable<SocialPost>;
  savePost(postId: string): Observable<SocialPost>;
  unsavePost(postId: string): Observable<SocialPost>;
  /** Tra ve bai chia se moi (bai goc nam trong sharedPost). */
  sharePost(postId: string, caption: string, visibility: PostVisibility): Observable<SocialPost>;
  reportContent(request: CreateContentReportRequest): Observable<ContentReport>;
  /** Keo "Tim nguoi choi" con mo, moi nhat truoc: ca nhan (Trang chu) hoac CLB (trang Cau lac bo). */
  getOpenPlayerCalls(club: boolean, limit: number, sport?: PostSport | null): Observable<SocialPost[]>;
  setPlayerCallFilled(postId: string, filled: boolean): Observable<SocialPost>;
}

export const SOCIAL_FEED_REPOSITORY_TOKEN = new InjectionToken<SocialFeedRepository>('SocialFeedRepository');
