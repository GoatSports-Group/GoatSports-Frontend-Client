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
  SocialPostShare,
  UserFollowStatus
} from '@application/dto/social-feed/social-feed.dto';

export interface SocialFeedRepository {
  getFeed(page: number, size: number, followingOnly?: boolean): Observable<SpringPageResponse<SocialPost>>;
  getFollowingUserIds(): Observable<string[]>;
  followUser(userId: string): Observable<UserFollowStatus>;
  unfollowUser(userId: string): Observable<UserFollowStatus>;
  createPost(request: SaveSocialPostRequest): Observable<SocialPost>;
  updatePost(postId: string, request: SaveSocialPostRequest): Observable<SocialPost>;
  deletePost(postId: string): Observable<void>;
  getComments(postId: string, page: number, size: number): Observable<SpringPageResponse<SocialComment>>;
  createComment(postId: string, request: SaveSocialCommentRequest): Observable<SocialComment>;
  updateComment(commentId: string, content: string): Observable<SocialComment>;
  deleteComment(commentId: string): Observable<void>;
  likePost(postId: string): Observable<SocialPost>;
  unlikePost(postId: string): Observable<SocialPost>;
  sharePost(postId: string, caption: string): Observable<SocialPostShare>;
  reportContent(request: CreateContentReportRequest): Observable<ContentReport>;
}

export const SOCIAL_FEED_REPOSITORY_TOKEN = new InjectionToken<SocialFeedRepository>('SocialFeedRepository');
