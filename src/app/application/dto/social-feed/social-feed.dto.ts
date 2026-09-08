export type PostVisibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
export type PostStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'REMOVED';
export type AttachmentType = 'IMAGE' | 'VIDEO' | 'FILE';
export type ReportTargetType = 'POST' | 'COMMENT';
export type ReportStatus = 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'REJECTED';

export interface SocialPostAttachment {
  attachmentId: string;
  storageKey: string;
  type: AttachmentType;
  displayOrder: number | null;
}

export interface SaveSocialPostRequest {
  content: string | null;
  visibility: PostVisibility;
  attachments: Array<Pick<SocialPostAttachment, 'storageKey' | 'type' | 'displayOrder'>>;
}

export interface SocialPost {
  postId: string;
  authorId: string;
  content: string;
  visibility: PostVisibility;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  attachments: SocialPostAttachment[];
  likeCount: number;
  commentCount: number;
  shareCount: number;
  likedByCurrentUser: boolean;
}

export interface SocialComment {
  commentId: string;
  postId: string;
  authorId: string;
  parentCommentId: string | null;
  content: string;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SaveSocialCommentRequest {
  parentCommentId: string | null;
  content: string;
}

export interface SocialPostShare {
  shareId: string;
  postId: string;
  userId: string;
  caption: string | null;
  sharedAt: string;
}

export interface CreateContentReportRequest {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  evidence: string[];
}

export interface ContentReport {
  reportId: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  evidence: string[];
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}
