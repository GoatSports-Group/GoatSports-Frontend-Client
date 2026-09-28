import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild,
  computed, inject, signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, map, of, switchMap } from 'rxjs';
import {
  AttachmentType, PostSport, PostVisibility, SavePlayerCallRequest, SaveSocialPostRequest, SocialPost, SocialPostAttachment
} from '@application/dto/social-feed/social-feed.dto';
import { MyClubMembership } from '@application/dto/club/club.dto';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { PLAY_FORMATS } from '@domain/models/matchmaking.model';
import { SOCIAL_FEED_REPOSITORY_TOKEN } from '@application/ports/persistence/social-feed.repository';
import { STORAGE_REPOSITORY_TOKEN } from '@application/ports/persistence/storage.repository';
import { AuthService } from '@presentation/services/auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { CommunityStore } from './community.store';
import { SPORT_SELECT_OPTIONS, VISIBILITY_META, VISIBILITY_OPTIONS, errorMessage } from './community-view';
import { MentionOption, MentionPicker } from './mention-picker';

interface PendingAttachment {
  file: File;
  type: AttachmentType;
  previewUrl: string;
}

const MAX_ATTACHMENTS = 10;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_CONTENT = 5000;

/** Mo o soan o che do "Tim nguoi choi" voi mon/hinh thuc dien san (vd tu trang ghep tran). */
export interface PlayerCallPrefill {
  sport: PostSport | null;
  format: string | null;
}

function localDate(offsetDays = 0): string {
  const value = new Date(Date.now() + offsetDays * 86_400_000);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

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
  private readonly clubRepository = inject(ClubRepositoryPort);
  readonly auth = inject(AuthService);
  readonly store = inject(CommunityStore);

  /** Bai dang sua; null la soan bai moi. */
  @Input() post: SocialPost | null = null;
  /** Mon mac dinh cho bai moi (bo loc dang chon tren bang tin). */
  @Input() defaultSport: PostSport | null = null;
  @Input() set prefill(value: PlayerCallPrefill | null) {
    if (!value || this.post) return;
    this.kind.set('CALL');
    if (value.sport) this.selectCallSport(value.sport);
    if (value.format && this.callFormats().some(item => item.value === value.format)) this.callFormat.set(value.format);
  }
  @Output() readonly saved = new EventEmitter<SocialPost>();
  @Output() readonly cancelled = new EventEmitter<void>();
  @ViewChild('textArea') private textArea?: ElementRef<HTMLTextAreaElement>;

  /** Goi y @nhac ten; id listbox rieng cho moi o soan (bai moi / tung bai dang sua). */
  readonly mentions = new MentionPicker(this.store, () => this.auth.currentUser?.userId ?? null,
    `mentions-${Math.random().toString(36).slice(2, 8)}`);

  readonly content = signal('');
  readonly visibility = signal<PostVisibility>('PUBLIC');
  readonly sport = signal<PostSport | null>(null);
  readonly pending = signal<PendingAttachment[]>([]);
  readonly retained = signal<SocialPostAttachment[]>([]);
  readonly publishing = signal(false);

  /** Cong dong la noi tim nguoi choi, nen bai moi mac dinh la keo "Tim nguoi choi". */
  readonly kind = signal<'CALL' | 'POST'>('CALL');
  readonly callSport = signal<PostSport | null>(null);
  readonly callFormat = signal<string | null>(null);
  readonly callDate = signal(localDate(1));
  readonly callStart = signal('18:00');
  readonly callEnd = signal('20:00');
  readonly callLocation = signal('');
  readonly callSlots = signal(1);
  readonly callSkill = signal('');
  readonly callClubId = signal<string | null>(null);
  readonly memberships = signal<MyClubMembership[] | null>(null);
  readonly today = localDate();
  readonly callFormats = computed(() => this.callSport() ? PLAY_FORMATS[this.callSport()!] : []);
  /** Chi chu hoac quan ly moi dang keo thay CLB (server kiem tra lai). */
  readonly callClubs = computed(() => (this.memberships() ?? []).filter(item =>
    item.status === 'ACTIVE' && (item.role === 'OWNER' || item.role === 'ADMIN')
    && item.club.sportType === this.callSport() && item.club.active !== false));
  readonly callValid = computed(() =>
    !!this.callSport() && this.callDate() >= this.today && !!this.callStart() && this.callEnd() > this.callStart()
    && this.callLocation().trim().length > 0 && this.callSlots() >= 1 && this.callSlots() <= 30);

  readonly maxContent = MAX_CONTENT;
  readonly sportOptions = SPORT_SELECT_OPTIONS;
  readonly visibilityOptions = VISIBILITY_OPTIONS;

  readonly attachmentCount = computed(() => this.pending().length + this.retained().length);
  readonly canPublish = computed(() =>
    !this.publishing()
    && this.content().length <= MAX_CONTENT
    && (this.isCall ? this.callValid()
      : this.isShare || this.content().trim().length > 0 || this.attachmentCount() > 0)
  );

  get isCall(): boolean {
    return this.kind() === 'CALL' && !this.isShare;
  }

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
      this.mentions.reset(this.post.mentions ?? []);
      const call = this.post.playerCall;
      this.kind.set(call ? 'CALL' : 'POST');
      if (call) {
        this.selectCallSport(call.sport);
        this.callFormat.set(call.playFormat);
        this.callDate.set(call.playDate);
        this.callStart.set(call.startTime.slice(0, 5));
        this.callEnd.set(call.endTime.slice(0, 5));
        this.callLocation.set(call.location);
        this.callSlots.set(call.slots);
        this.callSkill.set(call.skillNote ?? '');
        this.callClubId.set(call.clubId);
      }
    } else {
      this.sport.set(this.defaultSport);
      if (!this.callSport()) this.selectCallSport(this.defaultSport);
    }
  }

  setKind(kind: 'CALL' | 'POST'): void {
    this.kind.set(kind);
    if (kind === 'CALL') this.loadClubs();
  }

  selectCallSport(sport: PostSport | null): void {
    this.callSport.set(sport);
    const formats = sport ? PLAY_FORMATS[sport] : [];
    if (!formats.some(item => item.value === this.callFormat())) this.callFormat.set(null);
    if (!this.callClubs().some(item => item.club.clubId === this.callClubId())) this.callClubId.set(null);
    this.loadClubs();
  }

  private loadClubs(): void {
    if (this.memberships() || !this.auth.currentUser) return;
    this.memberships.set([]);
    this.clubRepository.getMyClubs().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: memberships => this.memberships.set(Array.isArray(memberships) ? memberships : []),
      error: () => this.memberships.set([])
    });
  }

  private playerCallRequest(): SavePlayerCallRequest | null {
    if (!this.isCall) return null;
    return {
      sport: this.callSport()!,
      playFormat: this.callFormat(),
      playDate: this.callDate(),
      startTime: this.callStart(),
      endTime: this.callEnd(),
      location: this.callLocation().trim(),
      slots: this.callSlots(),
      skillNote: this.callSkill().trim() || null,
      clubId: this.callClubId()
    };
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
        const playerCall = this.playerCallRequest();
        const request: SaveSocialPostRequest = {
          content: this.content().trim() || null,
          visibility: playerCall ? 'PUBLIC' : this.visibility(),
          sport: playerCall ? playerCall.sport : this.sport(),
          mentions: this.mentions.mentionsFor(this.content()),
          attachments: [...retained, ...uploaded],
          playerCall
        };
        return this.post
          ? this.repository.updatePost(this.post.postId, request)
          : this.repository.createPost(request);
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.publishing.set(false))
    ).subscribe({
      next: saved => {
        this.notify.success(this.isEdit ? 'Đã cập nhật bài viết.'
          : saved.playerCall ? 'Đã đăng kèo tìm người chơi.' : 'Đã đăng bài viết.');
        this.store.hydrate([saved]);
        if (!this.isEdit) this.reset();
        this.saved.emit(saved);
      },
      error: error => this.notify.error(errorMessage(error, 'Không thể lưu bài viết.'))
    });
  }

  /** Goi y @ xu ly phim truoc; ngoai goi y, Ctrl/Cmd + Enter gui bai. */
  onKeydown(event: KeyboardEvent): void {
    const area = this.textArea?.nativeElement;
    if (area && this.mentions.keydown(event, area, value => this.content.set(value))) return;
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.submit();
    }
  }

  trackMention(): void {
    const area = this.textArea?.nativeElement;
    if (area && !this.isShare) this.mentions.track(area);
  }

  pickMention(person: MentionOption): void {
    const area = this.textArea?.nativeElement;
    if (area) this.mentions.pick(person, area, value => this.content.set(value));
  }

  private reset(): void {
    this.pending().forEach(item => URL.revokeObjectURL(item.previewUrl));
    this.pending.set([]);
    this.retained.set([]);
    this.content.set('');
    this.mentions.reset();
    this.visibility.set('PUBLIC');
    this.sport.set(this.defaultSport);
    this.callLocation.set('');
    this.callSkill.set('');
    this.callSlots.set(1);
  }

  private typeOf(file: File): AttachmentType {
    if (file.type.startsWith('image/')) return 'IMAGE';
    if (file.type.startsWith('video/')) return 'VIDEO';
    return 'FILE';
  }
}
