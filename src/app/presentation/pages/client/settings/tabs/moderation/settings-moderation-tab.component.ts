import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';
import { ModerationDecision } from '@application/dto/social-feed/social-feed.dto';
import { NotificationType } from '@application/dto/notification/notification.dto';
import { SOCIAL_FEED_REPOSITORY_TOKEN } from '@application/ports/persistence/social-feed.repository';
import { NotifyService } from '@shared/components/notify/notify.service';
import { NotificationService } from '@presentation/services/notification.service';

const PAGE = 10;
const MIN_REASON = 10;
const MAX_REASON = 2000;

/**
 * Quyet dinh kiem duyet ve noi dung / tai khoan cua minh: ly do, trang thai hien tai va khieu nai.
 * Quyet dinh moi den realtime (thong bao CONTENT_MODERATION) thi tai lai danh sach.
 */
@Component({
  selector: 'app-settings-moderation-tab',
  templateUrl: './settings-moderation-tab.component.html',
  styleUrls: ['./settings-moderation-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class SettingsModerationTabComponent {
  private readonly repository = inject(SOCIAL_FEED_REPOSITORY_TOKEN);
  private readonly notify = inject(NotifyService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly minReason = MIN_REASON;
  readonly maxReason = MAX_REASON;
  readonly decisions = signal<ModerationDecision[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(false);
  private page = 1;

  /** Quyet dinh dang soan khieu nai (popup). */
  readonly appealing = signal<ModerationDecision | null>(null);
  readonly appealReason = signal('');
  readonly submitting = signal(false);
  readonly reasonLength = computed(() => this.appealReason().trim().length);
  readonly reasonValid = computed(() => this.reasonLength() >= MIN_REASON && this.reasonLength() <= MAX_REASON);

  constructor() {
    this.load();
    this.notifications.realtimeNotifications$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(notification => {
      if (notification.type === NotificationType.CONTENT_MODERATION) this.load();
    });
  }

  load(): void {
    this.page = 1;
    this.loading.set(true);
    this.error.set(false);
    this.repository.getMyModerationDecisions(1, PAGE).pipe(
      finalize(() => this.loading.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: page => {
        this.decisions.set(page.content);
        this.hasMore.set(!page.last);
      },
      error: () => this.error.set(true)
    });
  }

  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    this.repository.getMyModerationDecisions(this.page + 1, PAGE).pipe(
      finalize(() => this.loadingMore.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: page => {
        this.page += 1;
        const seen = new Set(this.decisions().map(item => item.actionId));
        this.decisions.update(current => [...current, ...page.content.filter(item => !seen.has(item.actionId))]);
        this.hasMore.set(!page.last);
      },
      error: () => this.notify.error('Không tải thêm được quyết định kiểm duyệt.')
    });
  }

  openAppeal(decision: ModerationDecision): void {
    this.appealReason.set('');
    this.appealing.set(decision);
  }

  closeAppeal(): void {
    if (!this.submitting()) this.appealing.set(null);
  }

  submitAppeal(): void {
    const decision = this.appealing();
    if (!decision || !this.reasonValid() || this.submitting()) return;
    this.submitting.set(true);
    this.repository.appealDecision(decision.actionId, this.appealReason().trim()).pipe(
      finalize(() => this.submitting.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.appealing.set(null);
        this.notify.success('Đã gửi khiếu nại. Bạn sẽ nhận thông báo khi quản trị viên xét xong.');
        this.load();
      },
      error: error => this.notify.error(error?.error?.message || 'Không gửi được khiếu nại. Vui lòng thử lại.')
    });
  }

  title(decision: ModerationDecision): string {
    const what = this.targetLabel(decision);
    switch (decision.actionType) {
      case 'HIDE_CONTENT': return `${what} đã bị ẩn`;
      case 'REMOVE_CONTENT': return `${what} đã bị gỡ`;
      case 'RESTORE_CONTENT': return `${what} đã được hiển thị lại`;
      default: return 'Cảnh cáo từ quản trị viên';
    }
  }

  icon(decision: ModerationDecision): string {
    switch (decision.actionType) {
      case 'HIDE_CONTENT': return 'eye-off';
      case 'REMOVE_CONTENT': return 'trash-2';
      case 'RESTORE_CONTENT': return 'undo-2';
      default: return 'triangle-alert';
    }
  }

  tone(decision: ModerationDecision): 'danger' | 'warning' | 'success' {
    if (decision.actionType === 'RESTORE_CONTENT') return 'success';
    return decision.actionType === 'WARNING' ? 'warning' : 'danger';
  }

  appealLabel(decision: ModerationDecision): string {
    switch (decision.appeal?.status) {
      case 'PENDING': return 'Khiếu nại đang chờ xét';
      case 'APPROVED': return 'Khiếu nại được chấp nhận';
      case 'REJECTED': return 'Khiếu nại không được chấp nhận';
      default: return '';
    }
  }

  appealTone(decision: ModerationDecision): string {
    switch (decision.appeal?.status) {
      case 'APPROVED': return 'badge--success';
      case 'REJECTED': return 'badge--danger';
      default: return 'badge--info';
    }
  }

  /** Vi sao khong khieu nai duoc nua (khi chua co khieu nai). */
  closedNote(decision: ModerationDecision): string | null {
    if (decision.appeal || decision.appealable || decision.actionType === 'RESTORE_CONTENT') return null;
    return 'Quyết định này đã được thay bằng quyết định mới hơn.';
  }

  contentStatus(status: string | null): string | null {
    switch (status) {
      case 'PUBLISHED': return 'Đang hiển thị';
      case 'HIDDEN': return 'Đang bị ẩn';
      case 'REMOVED': return 'Đã bị gỡ';
      default: return null;
    }
  }

  private targetLabel(decision: ModerationDecision): string {
    switch (decision.targetType) {
      case 'COMMENT': return 'Bình luận';
      case 'MESSAGE': return 'Tin nhắn';
      case 'USER': return 'Tài khoản';
      default: return 'Bài viết';
    }
  }
}
