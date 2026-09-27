import {
  ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, Input, OnDestroy, OnInit, Output, computed, inject, signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, map, of, switchMap } from 'rxjs';
import {
  AttachmentType, PostSport, PostVisibility, SaveSocialPostRequest, SocialPost, SocialPostAttachment
} from '@application/dto/social-feed/social-feed.dto';
import { SOCIAL_FEED_REPOSITORY_TOKEN } from '@application/ports/persistence/social-feed.repository';
import { STORAGE_REPOSITORY_TOKEN } from '@application/ports/persistence/storage.repository';
import { AuthService } from '@presentation/services/auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { CommunityStore } from './community.store';
import { SPORT_SELECT_OPTIONS, VISIBILITY_META, VISIBILITY_OPTIONS, errorMessage } from './community-view';

interface PendingAttachment {
  file: File;
  type: AttachmentType;
  previewUrl: string;
}

const MAX_ATTACHMENTS = 10;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_CONTENT = 5000;

/** Soan bai moi, hoac sua tai cho khi co {@link post}. Bai chia se chi sua loi dan va quyen rieng tu. */
@Component({
  selector: 'app-post-composer',
  templateUrl: './post-composer.component.html',
  styleUrls: ['./post-composer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class PostComposerComponent implements OnInit, OnDestroy {
  private readonly repository = inject(SOCIAL_FEED_REPOSITORY_TOKEN);
  private readonly storage = inject(STORAGE_REPOSITORY_TOKEN);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);
  readonly store = inject(CommunityStore);

  /** Bai dang sua; null la soan bai moi. */
  @Input() post: SocialPost | null = null;
  /** Mon mac dinh cho bai moi (bo loc dang chon tren bang tin). */
  @Input() defaultSport: PostSport | null = null;
  @Output() readonly saved = new EventEmitter<SocialPost>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly content = signal('');
  readonly visibility = signal<PostVisibility>('PUBLIC');
  readonly sport = signal<PostSport | null>(null);
  readonly pending = signal<PendingAttachment[]>([]);
  readonly retained = signal<SocialPostAttachment[]>([]);
  readonly publishing = signal(false);

  readonly maxContent = MAX_CONTENT;
  readonly sportOptions = SPORT_SELECT_OPTIONS;
  readonly visibilityOptions = VISIBILITY_OPTIONS;

  readonly attachmentCount = computed(() => this.pending().length + this.retained().length);
  readonly canPublish = computed(() =>
    !this.publishing()
    && this.content().length <= MAX_CONTENT
    && (this.isShare || this.content().trim().length > 0 || this.attachmentCount() > 0)
  );

  get isEdit(): boolean {
    return this.post !== null;
  }

  get isShare(): boolean {
    return !!this.post?.sharedPostId;
  }

  get visibilityIcon(): string {
    return VISIBILITY_META[this.visibility()].icon;
  }

  ngOnInit(): void {
    if (this.post) {
      this.content.set(this.post.content ?? '');
      this.visibility.set(this.post.visibility);
      this.sport.set(this.post.sport);
      this.retained.set([...this.post.attachments]);
    } else {
      this.sport.set(this.defaultSport);
    }
  }

  ngOnDestroy(): void {
    this.pending().forEach(item => URL.revokeObjectURL(item.previewUrl));
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    const room = MAX_ATTACHMENTS - this.attachmentCount();
    if (!files.length) return;
    if (room <= 0) {
      this.notify.warning(`Mỗi bài viết đính kèm tối đa ${MAX_ATTACHMENTS} tệp.`);
      return;
    }
    const accepted: PendingAttachment[] = [];
    for (const file of files.slice(0, room)) {
      if (file.size > MAX_FILE_BYTES) {
        this.notify.warning(`Tệp ${file.name} vượt quá 20 MB.`);
        continue;
      }
      accepted.push({ file, type: this.typeOf(file), previewUrl: URL.createObjectURL(file) });
    }
    this.pending.update(current => [...current, ...accepted]);
    if (files.length > room) this.notify.warning(`Chỉ ${room} tệp đầu tiên được thêm.`);
  }

  removePending(index: number): void {
    const item = this.pending()[index];
    if (item) URL.revokeObjectURL(item.previewUrl);
    this.pending.update(items => items.filter((_, i) => i !== index));
  }

  removeRetained(attachmentId: string): void {
    this.retained.update(items => items.filter(item => item.attachmentId !== attachmentId));
  }

  submit(): void {
    if (!this.canPublish()) return;
    this.publishing.set(true);
    const retained = this.retained().map((item, index) => ({
      storageKey: item.storageKey, type: item.type, displayOrder: index
    }));
    const pending = this.pending();
    const uploads$ = pending.length
      ? this.storage.uploadImages(pending.map(item => item.file), 'social-posts').pipe(
        map(keys => keys.map((storageKey, index) => ({
          storageKey, type: pending[index].type, displayOrder: retained.length + index
        }))))
      : of([]);

    uploads$.pipe(
      switchMap(uploaded => {
        const request: SaveSocialPostRequest = {
          content: this.content().trim() || null,
          visibility: this.visibility(),
          sport: this.sport(),
          attachments: [...retained, ...uploaded]
        };
        return this.post
          ? this.repository.updatePost(this.post.postId, request)
          : this.repository.createPost(request);
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.publishing.set(false))
    ).subscribe({
      next: saved => {
        this.notify.success(this.isEdit ? 'Đã cập nhật bài viết.' : 'Đã đăng bài viết.');
        this.store.hydrate([saved]);
        if (!this.isEdit) this.reset();
        this.saved.emit(saved);
      },
      error: error => this.notify.error(errorMessage(error, 'Không thể lưu bài viết.'))
    });
  }

  /** Ctrl/Cmd + Enter gui bai. */
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.submit();
    }
  }

  private reset(): void {
    this.pending().forEach(item => URL.revokeObjectURL(item.previewUrl));
    this.pending.set([]);
    this.retained.set([]);
    this.content.set('');
    this.visibility.set('PUBLIC');
    this.sport.set(this.defaultSport);
  }

  private typeOf(file: File): AttachmentType {
    if (file.type.startsWith('image/')) return 'IMAGE';
    if (file.type.startsWith('video/')) return 'VIDEO';
    return 'FILE';
  }
}
