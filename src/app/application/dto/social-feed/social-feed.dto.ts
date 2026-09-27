export type PostVisibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
export type PostStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'REMOVED';
export type AttachmentType = 'IMAGE' | 'VIDEO' | 'FILE';

/** Nguoi duoc nhac ten; {@code name} la dung chuoi da chen vao noi dung ("@name"), giu link khi ho doi ten. */
export interface Mention {
  userId: string;
  name: string;
}
/** Cung bo gia tri voi SportType cua club-service. */
export type PostSport = 'FOOTBALL' | 'BADMINTON' | 'TENNIS' | 'PICKLEBALL' | 'BASKETBALL' | 'VOLLEYBALL';
export type ReportTargetType = 'POST' | 'COMMENT' | 'MESSAGE' | 'USER' | 'VENUE' | 'REVIEW';
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
  sport: PostSport | null;
  mentions: Mention[];
  attachments: Array<Pick<SocialPostAttachment, 'storageKey' | 'type' | 'displayOrder'>>;
}

export interface SocialPost {
  postId: string;
  authorId: string;
  content: string;
  visibility: PostVisibility;
  status: PostStatus;
  sport: PostSport | null;
  /** Bai goc khi day la bai chia se. */
  sharedPostId: string | null;
  /** Chi co khi nguoi xem van duoc xem bai goc. */
  sharedPost: SocialPost | null;
  sharedPostUnavailable: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  attachments: SocialPostAttachment[];
  /** Hashtag server trich tu noi dung (chu thuong, khong dau #). */
  tags: string[];
  mentions: Mention[];
  likeCount: number;
  commentCount: number;
  shareCount: number;
  likedByCurrentUser: boolean;
  savedByCurrentUser: boolean;
}

export interface SocialComment {
  commentId: string;
  postId: string;
  authorId: string;
  parentCommentId: string | null;
  content: string;
  mentions?: Mention[];
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SaveSocialCommentRequest {
  parentCommentId: string | null;
  content: string;
  mentions: Mention[];
}

export interface FeedFilter {
  followingOnly?: boolean;
  sport?: PostSport | null;
  authorId?: string | null;
  tag?: string | null;
}

export interface AuthorStats {
  authorId: string;
  postCount: number;
}

export interface TrendingTag {
  tag: string;
  postCount: number;
}

/** Tac gia dang bai cong khai nhieu nhat trong 30 ngay qua. */
export interface FollowSuggestion {
  authorId: string;
  postCount: number;
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

export interface UserFollowStatus {
  userId: string;
  followed: boolean;
  followerCount: number;
  followingCount: number;
}
