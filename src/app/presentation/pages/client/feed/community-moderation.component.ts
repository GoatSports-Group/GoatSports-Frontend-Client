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
 * Tab "Kiem duyet" cua Cong dong: quyet dinh kiem duyet ve noi dung / tai khoan cua minh, ly do va khieu nai.
 * Quyet dinh moi den realtime (thong bao CONTENT_MODERATION) thi tai lai danh sach.
 */
@Component({
  selector: 'app-community-moderation',
  templateUrl: './community-moderation.component.html',
  styleUrls: ['./community-moderation.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class CommunityModerationComponent {
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
  /**
   * Quyet dinh moi nhat cua moi noi dung (danh sach moi nhat truoc): chi dong nay mang nhan trang thai hien tai,
   * de quyet dinh cu ("da hien thi lai") khong mang nhan "Dang bi an" cua hien tai.
   */
  readonly latestIds = computed(() => {
    const seen = new Set<string>();
    const latest = new Set<string>();
    for (const decision of this.decisions()) {
      const key = `${decision.targetType}:${decision.targetId}`;
      if (!seen.has(key)) {
        seen.add(key);
        latest.add(decision.actionId);
      }
    }
    return latest;
  });

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

  /** Nhan trang thai hien tai, chi voi quyet dinh moi nhat cua noi dung. */
  contentStatus(decision: ModerationDecision): string | null {
    if (!this.latestIds().has(decision.actionId)) return null;
    switch (decision.contentStatus) {
      case 'PUBLISHED': return 'Hiện tại: đang hiển thị';
      case 'HIDDEN': return 'Hiện tại: đang bị ẩn';
      case 'REMOVED': return 'Hiện tại: đã bị gỡ';
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
