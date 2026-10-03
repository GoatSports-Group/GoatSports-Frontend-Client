import { ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { PostDialogService } from './post-dialog.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { SocialPost } from '@application/dto/social-feed/social-feed.dto';
import { CHAT_REPOSITORY_TOKEN } from '@application/ports/persistence/chat.repository';
import { SOCIAL_FEED_REPOSITORY_TOKEN } from '@application/ports/persistence/social-feed.repository';
import { playFormatLabel } from '@domain/models/matchmaking.model';
import { AuthService } from '@presentation/services/auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { CommunityStore } from './community.store';
import { errorMessage, relativeTime, sportLabel } from './community-view';

/**
 * Thong tin mot keo "Tim nguoi choi" va hanh dong cua no. Khong co dang ky hay duyet: nguoi quan tam bam
 * "Nhan tin" de mo chat 1-1 voi nguoi dang roi hai ben tu chot san; nguoi dang danh dau "Da du nguoi".
 * {@link compact} = the rut gon cho Trang chu va trang Cau lac bo (kem nguoi dang).
 */
@Component({
  selector: 'app-player-call',
  templateUrl: './player-call.component.html',
  styleUrls: ['./player-call.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class PlayerCallComponent {
  private readonly repository = inject(SOCIAL_FEED_REPOSITORY_TOKEN);
  private readonly chatRepository = inject(CHAT_REPOSITORY_TOKEN);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly postDialog = inject(PostDialogService);
  readonly auth = inject(AuthService);
  readonly store = inject(CommunityStore);

  private readonly postState = signal<SocialPost | null>(null);
  @Input({ required: true }) set post(value: SocialPost) { this.postState.set(value); }
  get post(): SocialPost { return this.postState()!; }
  @Input() compact = false;
  @Output() readonly changed = new EventEmitter<SocialPost>();

  readonly busy = signal(false);
  readonly relativeTime = relativeTime;
  readonly call = computed(() => this.postState()?.playerCall ?? null);
  readonly isOwn = computed(() => this.postState()?.authorId === this.auth.currentUser?.userId);
  readonly title = computed(() => {
    const call = this.call();
    if (!call) return '';
    const format = playFormatLabel(call.playFormat);
    return format ? `${sportLabel(call.sport)} · ${format}` : sportLabel(call.sport);
  });
  readonly when = computed(() => {
    const call = this.call();
    if (!call) return '';
    const [year, month, day] = call.playDate.split('-').map(Number);
    const date = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })
      .format(new Date(year, month - 1, day));
    return `${date} · ${call.startTime.slice(0, 5)}–${call.endTime.slice(0, 5)}`;
  });

  message(): void {
    if (!this.auth.currentUser) {
      this.auth.notifyAuthenticationRequired('Vui lòng đăng nhập để nhắn tin cho người đăng kèo.');
      return;
    }
    this.busy.set(true);
    this.chatRepository.getOrCreateDirectRoom({ targetUserId: this.post.authorId }).pipe(
      finalize(() => this.busy.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: response => { if (response.data) void this.router.navigate(['/chat', response.data.roomId]); },
      error: error => this.notify.error(errorMessage(error, 'Không mở được cuộc trò chuyện.'))
    });
  }

  toggleFilled(): void {
    const call = this.call();
    if (!call) return;
    this.busy.set(true);
    this.repository.setPlayerCallFilled(this.post.postId, !call.filled).pipe(
      finalize(() => this.busy.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: saved => {
        this.postState.set(saved);
        this.changed.emit(saved);
        this.notify.success(saved.playerCall?.filled ? 'Đã đánh dấu kèo đủ người.' : 'Đã mở lại kèo.');
      },
      error: error => this.notify.error(errorMessage(error, 'Không cập nhật được kèo.'))
    });
  }
}
