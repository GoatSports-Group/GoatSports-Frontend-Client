import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin, map, of, switchMap, catchError } from 'rxjs';
import {
  AttachmentType,
  PostVisibility,
  ReportTargetType,
  SaveSocialPostRequest,
  SocialComment,
  SocialPost,
  SocialPostAttachment
} from '@application/dto/social-feed/social-feed.dto';
import { User } from '@application/dto/user/user.dto';
import { SOCIAL_FEED_REPOSITORY_TOKEN } from '@application/ports/persistence/social-feed.repository';
import { STORAGE_REPOSITORY_TOKEN } from '@application/ports/persistence/storage.repository';
import { AuthService } from '@presentation/services/auth.service';
import { PlayerDirectoryService } from '@presentation/services/player-directory.service';
import { NotifyService } from '@shared/components/notify/notify.service';

interface PendingAttachment {
  file: File;
  type: AttachmentType;
  previewUrl: string;
}

interface ReportTarget {
  type: ReportTargetType;
  id: string;
}

@Component({
  selector: 'app-social-feed',
  templateUrl: './social-feed.component.html',
  styleUrls: ['./social-feed.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class SocialFeedComponent implements OnInit, OnDestroy {
  private readonly repository = inject(SOCIAL_FEED_REPOSITORY_TOKEN);
  private readonly storageRepository = inject(STORAGE_REPOSITORY_TOKEN);
  readonly authService = inject(AuthService);
  private readonly directory = inject(PlayerDirectoryService);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  readonly posts = signal<SocialPost[]>([]);
  readonly authors = signal<ReadonlyMap<string, User>>(new Map());
  readonly mediaUrls = signal<ReadonlyMap<string, string>>(new Map());
  readonly comments = signal<ReadonlyMap<string, SocialComment[]>>(new Map());
  readonly expandedComments = signal<ReadonlySet<string>>(new Set());
  readonly commentDrafts = signal<ReadonlyMap<string, string>>(new Map());
  readonly replyTo = signal<ReadonlyMap<string, SocialComment>>(new Map());
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly publishing = signal(false);
  readonly actionPostIds = signal<ReadonlySet<string>>(new Set());
  readonly deletingCommentIds = signal<ReadonlySet<string>>(new Set());
  readonly hasMore = signal(false);
  readonly page = signal(1);

  readonly composerContent = signal('');
  readonly composerVisibility = signal<PostVisibility>('PUBLIC');
  readonly pendingAttachments = signal<PendingAttachment[]>([]);
  readonly retainedAttachments = signal<SocialPostAttachment[]>([]);
  readonly editingPostId = signal<string | null>(null);

  readonly shareTarget = signal<SocialPost | null>(null);
  readonly shareCaption = signal('');
  readonly sharing = signal(false);
  readonly reportTarget = signal<ReportTarget | null>(null);
  readonly reportReason = signal('');
  readonly reporting = signal(false);

  readonly visibilityOptions: ReadonlyArray<{ value: PostVisibility; label: string; icon: string }> = [
    { value: 'PUBLIC', label: 'Công khai', icon: 'globe' },
    { value: 'FRIENDS', label: 'Bạn bè', icon: 'users' },
    { value: 'PRIVATE', label: 'Chỉ mình tôi', icon: 'lock' }
  ];

  readonly attachmentCount = computed(() =>
    this.pendingAttachments().length + this.retainedAttachments().length
  );
  readonly canPublish = computed(() =>
    !this.publishing()
      && (this.composerContent().trim().length > 0 || this.attachmentCount() > 0)
      && this.attachmentCount() <= 10
  );

  ngOnInit(): void {
    this.loadFeed(true);
  }

  ngOnDestroy(): void {
    this.pendingAttachments().forEach(item => URL.revokeObjectURL(item.previewUrl));
  }

  get currentUser(): User | null {
    return this.authService.currentUser;
  }

  loadFeed(reset = false): void {
    if (reset) {
      this.page.set(1);
      this.loading.set(true);
    } else {
      this.loadingMore.set(true);
    }

    this.repository.getFeed(this.page(), 10).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.loading.set(false);
        this.loadingMore.set(false);
      })
    ).subscribe({
      next: response => {
        this.posts.update(current => reset ? response.content : [...current, ...response.content]);
        this.hasMore.set(!response.last);
        this.hydratePosts(response.content);
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể tải bảng tin.'))
    });
  }

  loadMore(): void {
    if (!this.hasMore() || this.loadingMore()) return;
    this.page.update(value => value + 1);
    this.loadFeed();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!this.requireLogin() || !files.length) return;

    const available = 10 - this.attachmentCount();
    if (available <= 0) {
      this.notify.warning('Mỗi bài viết chỉ được đính kèm tối đa 10 tệp.');
      return;
    }

    const accepted: PendingAttachment[] = [];
    for (const file of files.slice(0, available)) {
      if (file.size > 20 * 1024 * 1024) {
        this.notify.warning(`Tệp ${file.name} vượt quá giới hạn 20 MB.`);
        continue;
      }
      accepted.push({
        file,
        type: this.attachmentType(file),
        previewUrl: URL.createObjectURL(file)
      });
    }
    this.pendingAttachments.update(current => [...current, ...accepted]);
    if (files.length > available) this.notify.warning('Chỉ 10 tệp đầu tiên được chọn.');
  }

  removePendingAttachment(index: number): void {
    const item = this.pendingAttachments()[index];
    if (item) URL.revokeObjectURL(item.previewUrl);
    this.pendingAttachments.update(items => items.filter((_, itemIndex) => itemIndex !== index));
  }

  removeRetainedAttachment(attachmentId: string): void {
    this.retainedAttachments.update(items => items.filter(item => item.attachmentId !== attachmentId));
  }

  publish(): void {
    if (!this.requireLogin() || !this.canPublish()) return;
    this.publishing.set(true);

    const retained = this.retainedAttachments().map((item, index) => ({
      storageKey: item.storageKey,
      type: item.type,
      displayOrder: index
    }));
    const startOrder = retained.length;
    const uploads = this.pendingAttachments().map((item, index) => this.uploadAttachment(item, startOrder + index));
    const attachments$ = uploads.length ? forkJoin(uploads) : of([]);

    attachments$.pipe(
      switchMap(uploaded => {
        const request: SaveSocialPostRequest = {
          content: this.composerContent().trim(),
          visibility: this.composerVisibility(),
          attachments: [...retained, ...uploaded]
        };
        const editingId = this.editingPostId();
        return editingId
          ? this.repository.updatePost(editingId, request)
          : this.repository.createPost(request);
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.publishing.set(false))
    ).subscribe({
      next: post => {
        const editingId = this.editingPostId();
        this.posts.update(items => editingId
          ? items.map(item => item.postId === post.postId ? post : item)
          : [post, ...items]
        );
        this.resetComposer();
        this.hydratePosts([post]);
        this.notify.success(editingId ? 'Đã cập nhật bài viết.' : 'Đã đăng bài viết.');
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể lưu bài viết.'))
    });
  }

  editPost(post: SocialPost): void {
    if (!this.isOwner(post.authorId)) return;
    this.resetPendingAttachments();
    this.editingPostId.set(post.postId);
    this.composerContent.set(post.content ?? '');
    this.composerVisibility.set(post.visibility);
    this.retainedAttachments.set([...post.attachments]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.resetComposer();
  }

  deletePost(post: SocialPost): void {
    if (!this.isOwner(post.authorId) || !window.confirm('Bạn chắc chắn muốn xóa bài viết này?')) return;
    this.markPostAction(post.postId, true);
    this.repository.deletePost(post.postId).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.markPostAction(post.postId, false))
    ).subscribe({
      next: () => {
        this.posts.update(items => items.filter(item => item.postId !== post.postId));
        if (this.editingPostId() === post.postId) this.resetComposer();
        this.notify.success('Đã xóa bài viết.');
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể xóa bài viết.'))
    });
  }

  toggleLike(post: SocialPost): void {
    if (!this.requireLogin() || this.actionPostIds().has(post.postId)) return;
    this.markPostAction(post.postId, true);
    const action = post.likedByCurrentUser
      ? this.repository.unlikePost(post.postId)
      : this.repository.likePost(post.postId);
    action.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.markPostAction(post.postId, false))
    ).subscribe({
      next: updated => this.replacePost(updated),
      error: error => this.notify.error(this.errorMessage(error, 'Không thể cập nhật lượt thích.'))
    });
  }

  toggleComments(post: SocialPost): void {
    const expanded = new Set(this.expandedComments());
    if (expanded.has(post.postId)) {
      expanded.delete(post.postId);
      this.expandedComments.set(expanded);
      return;
    }
    expanded.add(post.postId);
    this.expandedComments.set(expanded);
    if (!this.comments().has(post.postId)) this.loadComments(post.postId);
  }

  submitComment(post: SocialPost): void {
    if (!this.requireLogin()) return;
    const content = (this.commentDrafts().get(post.postId) ?? '').trim();
    if (!content) return;
    const parent = this.replyTo().get(post.postId) ?? null;
    this.markPostAction(post.postId, true);
    this.repository.createComment(post.postId, {
      parentCommentId: parent?.commentId ?? null,
      content
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.markPostAction(post.postId, false))
    ).subscribe({
      next: comment => {
        this.comments.update(current => this.setMapValue(current, post.postId, [
          ...(current.get(post.postId) ?? []),
          comment
        ]));
        this.commentDrafts.update(current => this.setMapValue(current, post.postId, ''));
        this.clearReply(post.postId);
        this.posts.update(items => items.map(item => item.postId === post.postId
          ? { ...item, commentCount: item.commentCount + 1 }
          : item
        ));
        this.hydrateAuthors([comment.authorId]);
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể gửi bình luận.'))
    });
  }

  editComment(comment: SocialComment): void {
    if (!this.isOwner(comment.authorId)) return;
    const content = window.prompt('Chỉnh sửa bình luận', comment.content)?.trim();
    if (!content || content === comment.content) return;
    this.repository.updateComment(comment.commentId, content)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => this.comments.update(current => this.setMapValue(
          current,
          comment.postId,
          (current.get(comment.postId) ?? []).map(item => item.commentId === updated.commentId ? updated : item)
        )),
        error: error => this.notify.error(this.errorMessage(error, 'Không thể sửa bình luận.'))
      });
  }

  deleteComment(comment: SocialComment): void {
    if (!this.isOwner(comment.authorId) || !window.confirm('Xóa bình luận này?')) return;
    this.deletingCommentIds.update(ids => new Set(ids).add(comment.commentId));
    this.repository.deleteComment(comment.commentId).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.deletingCommentIds.update(ids => {
        const next = new Set(ids);
        next.delete(comment.commentId);
        return next;
      }))
    ).subscribe({
      next: () => {
        this.comments.update(current => this.setMapValue(
          current,
          comment.postId,
          (current.get(comment.postId) ?? []).filter(item => item.commentId !== comment.commentId)
        ));
        this.posts.update(items => items.map(item => item.postId === comment.postId
          ? { ...item, commentCount: Math.max(0, item.commentCount - 1) }
          : item
        ));
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể xóa bình luận.'))
    });
  }

  setReply(postId: string, comment: SocialComment): void {
    this.replyTo.update(current => this.setMapValue(current, postId, comment));
  }

  clearReply(postId: string): void {
    this.replyTo.update(current => {
      const next = new Map(current);
      next.delete(postId);
      return next;
    });
  }

  updateCommentDraft(postId: string, value: string): void {
    this.commentDrafts.update(current => this.setMapValue(current, postId, value));
  }

  openShare(post: SocialPost): void {
    if (!this.requireLogin()) return;
    this.shareTarget.set(post);
    this.shareCaption.set('');
  }

  closeShare(): void {
    if (!this.sharing()) this.shareTarget.set(null);
  }

  submitShare(): void {
    const post = this.shareTarget();
    if (!post || this.sharing()) return;
    this.sharing.set(true);
    this.repository.sharePost(post.postId, this.shareCaption().trim()).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.sharing.set(false))
    ).subscribe({
      next: () => {
        this.posts.update(items => items.map(item => item.postId === post.postId
          ? { ...item, shareCount: item.shareCount + 1 }
          : item
        ));
        this.shareTarget.set(null);
        this.notify.success('Đã chia sẻ bài viết.');
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể chia sẻ bài viết.'))
    });
  }

  openReport(type: ReportTargetType, id: string): void {
    if (!this.requireLogin()) return;
    this.reportTarget.set({ type, id });
    this.reportReason.set('');
  }

  closeReport(): void {
    if (!this.reporting()) this.reportTarget.set(null);
  }

  submitReport(): void {
    const target = this.reportTarget();
    const reason = this.reportReason().trim();
    if (!target || reason.length < 10 || this.reporting()) {
      if (reason.length < 10) this.notify.warning('Lý do báo cáo phải có ít nhất 10 ký tự.');
      return;
    }
    this.reporting.set(true);
    this.repository.reportContent({
      targetType: target.type,
      targetId: target.id,
      reason,
      evidence: []
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.reporting.set(false))
    ).subscribe({
      next: () => {
        this.reportTarget.set(null);
        this.notify.success('Báo cáo đã được gửi để kiểm duyệt.');
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể gửi báo cáo.'))
    });
  }

  author(userId: string): User | null {
    return this.authors().get(userId) ?? null;
  }

  mediaUrl(storageKey: string): string {
    return this.mediaUrls().get(storageKey) ?? '';
  }

  isOwner(userId: string): boolean {
    return this.currentUser?.userId === userId;
  }

  visibilityLabel(value: PostVisibility): string {
    return this.visibilityOptions.find(item => item.value === value)?.label ?? value;
  }

  visibilityIcon(value: PostVisibility): string {
    return this.visibilityOptions.find(item => item.value === value)?.icon ?? 'globe';
  }

  relativeTime(value: string): string {
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return 'Vừa xong';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} ngày trước`;
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
      .format(new Date(timestamp));
  }

  avatar(userId: string): string {
    const user = this.author(userId);
    if (user?.avatarUrl) return user.avatarUrl;
    const name = user?.fullName || user?.username || 'GOAT Sports';
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
  }

  authorName(userId: string): string {
    const user = this.author(userId);
    return user?.fullName || user?.username || 'Người dùng GOAT Sports';
  }

  private loadComments(postId: string): void {
    this.repository.getComments(postId, 1, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.comments.update(current => this.setMapValue(current, postId, response.content));
          this.hydrateAuthors(response.content.map(item => item.authorId));
        },
        error: error => this.notify.error(this.errorMessage(error, 'Không thể tải bình luận.'))
      });
  }

  private uploadAttachment(item: PendingAttachment, displayOrder: number) {
    return this.storageRepository.getPresignedUrl(item.file.name, item.file.type || 'application/octet-stream', 'social-posts').pipe(
      switchMap(urls => {
        const target = urls[0];
        if (!target?.uploadUrl || !target.objectKey) throw new Error('Storage service không trả về URL tải lên.');
        return this.storageRepository.uploadToPresignedUrl(target.uploadUrl, item.file).pipe(
          map(() => ({ storageKey: target.objectKey, type: item.type, displayOrder }))
        );
      })
    );
  }

  private hydratePosts(posts: readonly SocialPost[]): void {
    this.hydrateAuthors(posts.map(item => item.authorId));
    const attachments = posts.flatMap(post => post.attachments);
    const missing = attachments.filter(item => !this.mediaUrls().has(item.storageKey));
    if (!missing.length) return;

    forkJoin(missing.map(item => this.storageRepository.getFileUrl(item.storageKey).pipe(
      map(url => ({ key: item.storageKey, url })),
      catchError(() => of({ key: item.storageKey, url: '' }))
    ))).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(items => {
      const next = new Map(this.mediaUrls());
      items.forEach(item => next.set(item.key, item.url));
      this.mediaUrls.set(next);
    });
  }

  private hydrateAuthors(userIds: readonly string[]): void {
    this.directory.resolve(userIds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(resolved => {
        const next = new Map(this.authors());
        resolved.forEach((user, id) => next.set(id, user));
        this.authors.set(next);
      });
  }

  private replacePost(post: SocialPost): void {
    this.posts.update(items => items.map(item => item.postId === post.postId ? post : item));
    this.hydratePosts([post]);
  }

  private resetComposer(): void {
    this.resetPendingAttachments();
    this.composerContent.set('');
    this.composerVisibility.set('PUBLIC');
    this.retainedAttachments.set([]);
    this.editingPostId.set(null);
  }

  private resetPendingAttachments(): void {
    this.pendingAttachments().forEach(item => URL.revokeObjectURL(item.previewUrl));
    this.pendingAttachments.set([]);
  }

  private attachmentType(file: File): AttachmentType {
    if (file.type.startsWith('image/')) return 'IMAGE';
    if (file.type.startsWith('video/')) return 'VIDEO';
    return 'FILE';
  }

  private markPostAction(postId: string, active: boolean): void {
    this.actionPostIds.update(ids => {
      const next = new Set(ids);
      active ? next.add(postId) : next.delete(postId);
      return next;
    });
  }

  private requireLogin(): boolean {
    if (this.authService.currentUser) return true;
    this.authService.notifyAuthenticationRequired();
    return false;
  }

  private setMapValue<K, V>(source: ReadonlyMap<K, V>, key: K, value: V): ReadonlyMap<K, V> {
    const next = new Map(source);
    next.set(key, value);
    return next;
  }

  private errorMessage(error: unknown, fallback: string): string {
    const response = error as { error?: { message?: unknown; error?: unknown; detail?: unknown } };
    if (typeof response.error?.message === 'string' && response.error.message.trim()) return response.error.message;
    if (typeof response.error?.detail === 'string' && response.error.detail.trim()) return response.error.detail;
    if (typeof response.error?.error === 'string' && response.error.error.trim()) return response.error.error;
    return fallback;
  }
}
