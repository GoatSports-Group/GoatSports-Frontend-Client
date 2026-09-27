import {
  ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, Input, OnInit, Output, computed, inject, signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize } from 'rxjs';
import {
  PostVisibility, ReportTargetType, SocialComment, SocialPost, SocialPostAttachment
} from '@application/dto/social-feed/social-feed.dto';
import { FRIEND_REPOSITORY_TOKEN } from '@application/ports/persistence/friend.repository';
import { SOCIAL_FEED_REPOSITORY_TOKEN } from '@application/ports/persistence/social-feed.repository';
import { AuthService } from '@presentation/services/auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { CommunityStore } from './community.store';
import { LightboxItem } from './media-lightbox.component';
import {
  REPORT_REASONS, VISIBILITY_META, VISIBILITY_OPTIONS, compactCount, errorMessage, relativeTime, richText, sportLabel
} from './community-view';

interface CommentThread {
  comment: SocialComment;
  replies: SocialComment[];
}

type PendingConfirm = { kind: 'delete-post' } | { kind: 'block' } | { kind: 'delete-comment'; commentId: string };

const COMMENT_PAGE = 20;
const CLAMP_CHARS = 360;
const CLAMP_LINES = 6;

/**
 * Mot bai viet tren bang tin hoac trang chi tiet. The tu goi API cho moi tuong tac cua no;
 * trang cha chi nghe {@link changed} / {@link removed} / {@link shared} de cap nhat danh sach.
 */
@Component({
  selector: 'app-post-card',
  templateUrl: './post-card.component.html',
  styleUrls: ['./post-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class PostCardComponent implements OnInit {
  private readonly repository = inject(SOCIAL_FEED_REPOSITORY_TOKEN);
  private readonly friends = inject(FRIEND_REPOSITORY_TOKEN);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);
  readonly store = inject(CommunityStore);

  private readonly postState = signal<SocialPost | null>(null);
  @Input({ required: true }) set post(value: SocialPost) { this.postState.set(value); }
  get post(): SocialPost { return this.postState()!; }
  /** Trang chi tiet mo san binh luan. */
  @Input() openComments = false;

  @Output() readonly changed = new EventEmitter<SocialPost>();
  @Output() readonly removed = new EventEmitter<string>();
  /** Tac gia bi chan: trang cha go moi bai cua nguoi do. */
  @Output() readonly authorBlocked = new EventEmitter<string>();
  /** Bai chia se vua tao, de trang cha dua len dau bang tin. */
  @Output() readonly shared = new EventEmitter<SocialPost>();

  readonly visibilityMeta = VISIBILITY_META;
  readonly visibilityOptions = VISIBILITY_OPTIONS;
  readonly reportReasons = REPORT_REASONS;
  readonly sportLabel = sportLabel;
  readonly relativeTime = relativeTime;
  readonly compactCount = compactCount;

  readonly busy = signal(false);
  readonly editing = signal(false);
  readonly expanded = signal(false);
  readonly confirm = signal<PendingConfirm | null>(null);

  readonly commentsOpen = signal(false);
  readonly comments = signal<SocialComment[]>([]);
  readonly commentsLoading = signal(false);
  readonly commentsError = signal(false);
  readonly commentsPage = signal(1);
  readonly commentsHasMore = signal(false);
  readonly commentDraft = signal('');
  readonly replyTo = signal<SocialComment | null>(null);
  readonly sendingComment = signal(false);
  readonly editingCommentId = signal<string | null>(null);
  readonly editDraft = signal('');

  readonly shareOpen = signal(false);
  readonly shareCaption = signal('');
  readonly shareVisibility = signal<PostVisibility>('PUBLIC');
  readonly sharing = signal(false);

  readonly reportTarget = signal<{ type: ReportTargetType; id: string } | null>(null);
  readonly reportReason = signal('');
  readonly reporting = signal(false);

  readonly threads = computed<CommentThread[]>(() => {
    const all = this.comments();
    const ids = new Set(all.map(item => item.commentId));
    const roots = all.filter(item => !item.parentCommentId || !ids.has(item.parentCommentId));
    return roots.map(comment => ({
      comment,
      replies: all.filter(item => item.parentCommentId === comment.commentId)
    }));
  });

  readonly lightbox = signal<{ items: LightboxItem[]; start: number } | null>(null);

  /** Doc lai khi ten tac gia duoc nap xong, de "@Ho Ten" thanh link ngay khi co ten. */
  readonly contentSegments = computed(() => this.segments(this.postState()!));
  readonly originalSegments = computed(() => {
    const original = this.postState()!.sharedPost;
    return original ? this.segments(original) : [];
  });

  /** Bai goc khi day la bai chia se, nguoc lai chinh bai do: noi dung, media va nut chia se deu theo no. */
  readonly source = computed(() => {
    const post = this.postState()!;
    return post.sharedPostId ? post.sharedPost : post;
  });

  get me(): string | null {
    return this.auth.currentUser?.userId ?? null;
  }

  get isOwn(): boolean {
    return this.me === this.post.authorId;
  }

  get isLong(): boolean {
    const content = this.post.content ?? '';
    return content.length > CLAMP_CHARS || content.split('\n').length > CLAMP_LINES;
  }

  /** Chi bai cong khai chia se duoc (server cung chan). */
  get canShare(): boolean {
    const source = this.source();
    return !!source && source.visibility === 'PUBLIC';
  }

  ngOnInit(): void {
    if (this.openComments) this.toggleComments();
  }

  // ---- post actions --------------------------------------------------------------------------

  toggleLike(): void {
    const post = this.post;
    this.run(post.likedByCurrentUser ? this.repository.unlikePost(post.postId) : this.repository.likePost(post.postId),
      updated => this.replace(updated), 'Không thể cập nhật lượt thích.');
  }

  toggleSave(): void {
    const post = this.post;
    this.run(post.savedByCurrentUser ? this.repository.unsavePost(post.postId) : this.repository.savePost(post.postId),
      updated => {
        this.replace(updated);
        this.notify.success(updated.savedByCurrentUser ? 'Đã lưu bài viết.' : 'Đã bỏ lưu bài viết.');
      }, 'Không thể lưu bài viết.');
  }

  toggleFollow(): void {
    const authorId = this.post.authorId;
    this.store.toggleFollow(authorId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: status => this.notify.success(status.followed
        ? `Đang theo dõi ${this.store.authorName(authorId)}.`
        : `Đã bỏ theo dõi ${this.store.authorName(authorId)}.`),
      error: error => this.notify.error(errorMessage(error, 'Không thể cập nhật theo dõi.'))
    });
  }

  copyLink(): void {
    const url = `${location.origin}/feed/posts/${this.post.postId}`;
    navigator.clipboard?.writeText(url).then(
      () => this.notify.success('Đã sao chép liên kết bài viết.'),
      () => this.notify.error('Không sao chép được liên kết.')
    );
  }

  onEdited(updated: SocialPost): void {
    this.editing.set(false);
    this.replace(updated);
  }

  confirmAction(): void {
    const pending = this.confirm();
    if (!pending) return;
    if (pending.kind === 'delete-post') {
      this.run(this.repository.deletePost(this.post.postId), () => {
        this.notify.success('Đã xóa bài viết.');
        this.removed.emit(this.post.postId);
      }, 'Không thể xóa bài viết.');
    } else if (pending.kind === 'block') {
      const authorId = this.post.authorId;
      this.run(this.friends.blockUser({ blockedUserId: authorId }), () => {
        this.notify.success(`Đã chặn ${this.store.authorName(authorId)}. Bạn sẽ không thấy bài của họ nữa.`);
        this.authorBlocked.emit(authorId);
      }, 'Không thể chặn người dùng.');
    } else {
      this.deleteComment(pending.commentId);
    }
    this.confirm.set(null);
  }

  // ---- share & report ------------------------------------------------------------------------

  openShare(): void {
    this.shareCaption.set('');
    this.shareVisibility.set('PUBLIC');
    this.shareOpen.set(true);
  }

  closeShare(): void {
    if (!this.sharing()) this.shareOpen.set(false);
  }

  submitShare(): void {
    if (this.sharing()) return;
    this.sharing.set(true);
    this.repository.sharePost(this.post.postId, this.shareCaption().trim(), this.shareVisibility()).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.sharing.set(false))
    ).subscribe({
      next: share => {
        this.shareOpen.set(false);
        this.notify.success('Đã chia sẻ lên bảng tin của bạn.');
        this.store.hydrate([share]);
        // Luot chia se duoc tinh cho bai goc; the nay chi tu tang khi chinh no la bai goc.
        if (!this.post.sharedPostId) this.replace({ ...this.post, shareCount: this.post.shareCount + 1 });
        this.shared.emit(share);
      },
      error: error => this.notify.error(errorMessage(error, 'Không thể chia sẻ bài viết.'))
    });
  }

  openReport(type: ReportTargetType, id: string): void {
    this.reportReason.set('');
    this.reportTarget.set({ type, id });
  }

  closeReport(): void {
    if (!this.reporting()) this.reportTarget.set(null);
  }

  pickReason(reason: string): void {
    const current = this.reportReason().trim();
    this.reportReason.set(current ? `${current}. ${reason}` : reason);
  }

  submitReport(): void {
    const target = this.reportTarget();
    const reason = this.reportReason().trim();
    if (!target || reason.length < 10 || this.reporting()) return;
    this.reporting.set(true);
    this.repository.reportContent({ targetType: target.type, targetId: target.id, reason, evidence: [] }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.reporting.set(false))
    ).subscribe({
      next: () => {
        this.reportTarget.set(null);
        this.notify.success('Đã gửi báo cáo. Đội kiểm duyệt sẽ xem xét sớm.');
      },
      error: error => this.notify.error(errorMessage(error, 'Không thể gửi báo cáo.'))
    });
  }

  // ---- comments -------------------------------------------------------------------------------

  toggleComments(): void {
    const open = !this.commentsOpen();
    this.commentsOpen.set(open);
    if (open && !this.comments().length) this.loadComments(1);
  }

  loadComments(page: number): void {
    this.commentsLoading.set(true);
    this.commentsError.set(false);
    this.repository.getComments(this.post.postId, page, COMMENT_PAGE).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.commentsLoading.set(false))
    ).subscribe({
      next: response => {
        this.comments.update(current => page === 1 ? response.content : [...current, ...response.content]);
        this.commentsPage.set(page);
        this.commentsHasMore.set(!response.last);
        this.store.hydrateAuthors(response.content.map(item => item.authorId));
      },
      error: () => this.commentsError.set(true)
    });
  }

  reply(comment: SocialComment): void {
    this.replyTo.set(comment);
    queueMicrotask(() => document.getElementById(`comment-input-${this.post.postId}`)?.focus());
  }

  submitComment(): void {
    const content = this.commentDraft().trim();
    if (!content || this.sendingComment()) return;
    const parent = this.replyTo();
    // Tra loi mot tra loi thi gan vao binh luan goc, giu luong mot cap.
    const parentId = parent ? (parent.parentCommentId ?? parent.commentId) : null;
    this.sendingComment.set(true);
    this.repository.createComment(this.post.postId, { parentCommentId: parentId, content }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.sendingComment.set(false))
    ).subscribe({
      next: comment => {
        this.comments.update(current => [...current, comment]);
        this.commentDraft.set('');
        this.replyTo.set(null);
        this.replace({ ...this.post, commentCount: this.post.commentCount + 1 });
        this.store.hydrateAuthors([comment.authorId]);
      },
      error: error => this.notify.error(errorMessage(error, 'Không thể gửi bình luận.'))
    });
  }

  onCommentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submitComment();
    }
  }

  startEditComment(comment: SocialComment): void {
    this.editingCommentId.set(comment.commentId);
    this.editDraft.set(comment.content);
  }

  saveComment(comment: SocialComment): void {
    const content = this.editDraft().trim();
    if (!content || content === comment.content) {
      this.editingCommentId.set(null);
      return;
    }
    this.repository.updateComment(comment.commentId, content).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.comments.update(items => items.map(item => item.commentId === updated.commentId ? updated : item));
        this.editingCommentId.set(null);
      },
      error: error => this.notify.error(errorMessage(error, 'Không thể sửa bình luận.'))
    });
  }

  private deleteComment(commentId: string): void {
    this.repository.deleteComment(commentId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        // Xoa binh luan goc cung an luon cac tra loi cua no trong luong.
        const removed = this.comments().filter(item => item.commentId === commentId || item.parentCommentId === commentId);
        this.comments.update(items => items.filter(item => !removed.includes(item)));
        this.replace({ ...this.post, commentCount: Math.max(0, this.post.commentCount - 1) });
      },
      error: error => this.notify.error(errorMessage(error, 'Không thể xóa bình luận.'))
    });
  }

  // ---- view helpers ---------------------------------------------------------------------------

  /** Mo trinh xem tai dung anh vua bam; tep (PDF, DOC) khong vao trinh xem. */
  openLightbox(attachments: readonly SocialPostAttachment[], attachmentId: string): void {
    const viewable = attachments.filter(item => item.type !== 'FILE' && this.store.mediaUrl(item.storageKey));
    const start = Math.max(0, viewable.findIndex(item => item.attachmentId === attachmentId));
    this.lightbox.set({
      items: viewable.map(item => ({ url: this.store.mediaUrl(item.storageKey), type: item.type })),
      start
    });
  }

  private segments(post: SocialPost) {
    return richText(post.content, (post.mentions ?? []).map(userId => ({ userId, name: this.store.authorName(userId) })));
  }

  isEdited(item: { createdAt: string; updatedAt: string }): boolean {
    return new Date(item.updatedAt).getTime() - new Date(item.createdAt).getTime() > 60_000;
  }

  private run<T>(request$: Observable<T>, next: (value: T) => void, failure: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    request$.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next,
      error: error => this.notify.error(errorMessage(error, failure))
    });
  }

  private replace(post: SocialPost): void {
    this.postState.set(post);
    this.store.hydrate([post]);
    this.changed.emit(post);
  }
}
