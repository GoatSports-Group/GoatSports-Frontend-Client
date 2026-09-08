import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { SpringPageResponse } from '@application/dto/base/base-response';
import {
  ContentReport,
  CreateContentReportRequest,
  SaveSocialCommentRequest,
  SaveSocialPostRequest,
  SocialComment,
  SocialPost,
  SocialPostShare
} from '@application/dto/social-feed/social-feed.dto';
import { SocialFeedRepository } from '@application/ports/persistence/social-feed.repository';
import { SocialFeedApi } from '@infrastructure/api/social-feed.api';

@Injectable({ providedIn: 'root' })
export class SocialFeedRepositoryImpl implements SocialFeedRepository {
  private readonly api = inject(SocialFeedApi);

  getFeed(page: number, size: number): Observable<SpringPageResponse<SocialPost>> {
    return this.api.getFeed(page, size).pipe(map(response => response.data));
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

  updateComment(commentId: string, content: string): Observable<SocialComment> {
    return this.api.updateComment(commentId, content).pipe(map(response => response.data));
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

  sharePost(postId: string, caption: string): Observable<SocialPostShare> {
    return this.api.sharePost(postId, caption).pipe(map(response => response.data));
  }

  reportContent(request: CreateContentReportRequest): Observable<ContentReport> {
    return this.api.reportContent(request).pipe(map(response => response.data));
  }
}
