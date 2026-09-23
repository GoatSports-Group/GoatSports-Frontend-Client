import { Component, ElementRef, OnInit, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { Notification, NotificationStatus, NotificationType } from '@application/dto/notification/notification.dto';
import { AuthService } from '@presentation/services/auth.service';
import { NotificationService } from '@presentation/services/notification.service';
import { NotifyService } from '@shared/components/notify/notify.service';

type NotificationFilter = 'ALL' | 'UNREAD';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
  standalone: false
})
export class NotificationsComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly notificationService = inject(NotificationService);
  private readonly notifyService = inject(NotifyService);
  private readonly router = inject(Router);

  readonly activeFilter = signal<NotificationFilter>('ALL');
  readonly isLoading = signal(true);
  /** 0-based page shown by the shared pagination component. */
  readonly pageIndex = signal(0);
  /** Page change in flight: the current page stays on screen (dimmed) instead of a skeleton, so nothing jumps. */
  readonly isPaging = signal(false);
  private readonly listAnchor = viewChild<ElementRef<HTMLElement>>('listAnchor');
  readonly loadFailed = signal(false);
  readonly isMarkingAll = signal(false);
  readonly confirmingDeleteId = signal<string | null>(null);
  readonly pendingIds = signal<ReadonlySet<string>>(new Set());
  readonly avatarLoadFailed = signal(false);

  readonly NotificationStatus = NotificationStatus;
  readonly notifications$ = this.notificationService.notifications$;
  readonly unreadCount$ = this.notificationService.unreadCount$;
  readonly allCount$ = this.notificationService.allCount$;

  readonly pageSize = 10;
  readonly pageState$ = this.notificationService.pageState$;
  private requestSequence = 0;

  ngOnInit(): void {
    this.loadNotifications();
  }

  get avatarUrl(): string | null {
    if (this.avatarLoadFailed()) return null;
    return this.authService.currentUser?.avatarUrl || null;
  }

  get userInitials(): string {
    const user = this.authService.currentUser;
    const source = user?.fullName || user?.username || user?.email || 'GS';
    return source
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map(part => part.charAt(0).toUpperCase())
      .join('') || 'GS';
  }

  setFilter(filter: NotificationFilter): void {
    if (filter === this.activeFilter() && !this.loadFailed()) return;
    this.activeFilter.set(filter);
    this.confirmingDeleteId.set(null);
    this.pageIndex.set(0);
    this.loadNotifications();
  }

  retry(): void {
    this.loadNotifications();
  }

  changePage(pageIndex: number): void {
    this.pageIndex.set(pageIndex);
    this.confirmingDeleteId.set(null);
    this.loadNotifications(true);
  }

  onOpenNotification(notification: Notification): void {
    if (this.isPending(notification.notificationId)) return;

    if (notification.status === NotificationStatus.UNREAD) {
      this.markAsRead(notification, true);
      return;
    }

    this.navigateForNotification(notification);
  }

  onMarkAllRead(): void {
    if (this.isMarkingAll()) return;
    this.isMarkingAll.set(true);

    this.notificationService.markAllRead().pipe(
      finalize(() => this.isMarkingAll.set(false))
    ).subscribe({
      next: () => this.notifyService.success('Đã đánh dấu tất cả thông báo là đã đọc.'),
      error: () => this.notifyService.error('Không thể cập nhật thông báo. Vui lòng thử lại.')
    });
  }

  requestDelete(notification: Notification, event: Event): void {
    event.stopPropagation();
    this.confirmingDeleteId.set(notification.notificationId);
  }

  cancelDelete(event: Event): void {
    event.stopPropagation();
    this.confirmingDeleteId.set(null);
  }

  confirmDelete(notification: Notification, event: Event): void {
    event.stopPropagation();
    const id = notification.notificationId;
    if (this.isPending(id)) return;

    this.addPending(id);
    this.notificationService.deleteNotification(id).pipe(
      finalize(() => this.removePending(id))
    ).subscribe({
      next: () => {
        this.confirmingDeleteId.set(null);
        this.notifyService.success('Đã xóa thông báo.');
        this.refillPageAfterDelete();
      },
      error: () => this.notifyService.error('Không thể xóa thông báo. Vui lòng thử lại.')
    });
  }

  isPending(id: string): boolean {
    return this.pendingIds().has(id);
  }

  canOpenNotification(notification: Notification): boolean {
    return notification.status === NotificationStatus.UNREAD || this.getNotificationRoute(notification) !== null;
  }

  onAvatarImgError(): void {
    this.avatarLoadFailed.set(true);
  }

  getNotificationIcon(type?: NotificationType): string {
    switch (type) {
      case NotificationType.BOOKING:
        return 'calendar';
      case NotificationType.CHECK_IN:
        return 'check-circle';
      case NotificationType.REVIEW:
        return 'star';
      case NotificationType.PAYMENT:
        return 'credit-card';
      case NotificationType.REFUND:
        return 'wallet';
      case NotificationType.MATCHMAKING:
        return 'target';
      case NotificationType.FRIENDSHIP:
        return 'users';
      case NotificationType.MESSAGE:
        return 'mail';
      case NotificationType.CONTENT_MODERATION:
        return 'shield-alert';
      case NotificationType.CLUB:
        return 'swords';
      case NotificationType.TOURNAMENT:
        return 'trophy';
      case NotificationType.SYSTEM:
      default:
        return 'bell';
    }
  }

  /** Icon tone from the design status pairs (§3): money = info, bookings = success, moderation = danger. */
  getNotificationTone(type?: NotificationType): string {
    switch (type) {
      case NotificationType.PAYMENT:
      case NotificationType.REFUND: return 'info';
      case NotificationType.BOOKING:
      case NotificationType.CHECK_IN: return 'success';
      case NotificationType.REVIEW: return 'warning';
      case NotificationType.CONTENT_MODERATION: return 'danger';
      default: return 'primary';
    }
  }

  getNotificationTypeLabel(type?: NotificationType): string {
    switch (type) {
      case NotificationType.BOOKING: return 'Đặt sân';
      case NotificationType.CHECK_IN: return 'Nhận sân';
      case NotificationType.REVIEW: return 'Đánh giá';
      case NotificationType.PAYMENT: return 'Thanh toán';
      case NotificationType.REFUND: return 'Hoàn tiền';
      case NotificationType.MATCHMAKING: return 'Ghép trận';
      case NotificationType.FRIENDSHIP: return 'Kết nối';
      case NotificationType.MESSAGE: return 'Tin nhắn';
      case NotificationType.CONTENT_MODERATION: return 'Kiểm duyệt';
      case NotificationType.CLUB: return 'Câu lạc bộ';
      case NotificationType.TOURNAMENT: return 'Giải đấu';
      case NotificationType.SYSTEM:
      default: return 'Hệ thống';
    }
  }

  formatTime(dateStr?: string): string {
    if (!dateStr) return 'Không rõ thời gian';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return 'Không rõ thời gian';

    const diffMs = Math.max(0, Date.now() - date.getTime());
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 7) return `${diffDays} ngày trước`;

    return date.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  /**
   * Loads `pageIndex()` and replaces the list (page-based, not append). First load / filter change shows the
   * skeleton; a page change keeps the old page dimmed until the new one lands, then scrolls the list back into view.
   */
  private loadNotifications(paging = false): void {
    const sequence = ++this.requestSequence;
    const status = this.activeFilter() === 'UNREAD' ? NotificationStatus.UNREAD : undefined;

    (paging ? this.isPaging : this.isLoading).set(true);
    this.loadFailed.set(false);

    this.notificationService.fetchNotifications({ status, page: this.pageIndex() + 1, pageSize: this.pageSize }).pipe(
      finalize(() => {
        if (sequence !== this.requestSequence) return;
        this.isLoading.set(false);
        this.isPaging.set(false);
      })
    ).subscribe({
      next: () => {
        if (paging && sequence === this.requestSequence) this.scrollListIntoView();
      },
      error: () => {
        if (sequence !== this.requestSequence) return;
        this.loadFailed.set(true);
        if (paging) this.notifyService.error('Không thể tải trang thông báo. Vui lòng thử lại.');
      }
    });
  }

  private scrollListIntoView(): void {
    const anchor = this.listAnchor()?.nativeElement;
    // Only scroll when the user paged from below the fold (the list top is off screen).
    if (anchor && anchor.getBoundingClientRect().top < 64) {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * After a delete the page is one short: re-fetch it in append mode so the next item slides in without a
   * skeleton flash. An emptied page (not the first) steps back one page instead.
   */
  private refillPageAfterDelete(): void {
    const status = this.activeFilter() === 'UNREAD' ? NotificationStatus.UNREAD : undefined;
    this.notificationService.fetchNotifications(
      { status, page: this.pageIndex() + 1, pageSize: this.pageSize }, true
    ).subscribe({
      // A failed refill just leaves the page one item short; the next navigation reloads it.
      next: page => {
        if (page.items.length === 0 && this.pageIndex() > 0) this.changePage(this.pageIndex() - 1);
      }
    });
  }

  private markAsRead(notification: Notification, navigateAfter: boolean): void {
    const id = notification.notificationId;
    this.addPending(id);

    this.notificationService.markAsRead(id).pipe(
      finalize(() => this.removePending(id))
    ).subscribe({
      next: () => {
        if (navigateAfter) this.navigateForNotification(notification);
      },
      error: () => {
        this.notifyService.error('Không thể đánh dấu thông báo là đã đọc.');
        if (navigateAfter) this.navigateForNotification(notification);
      }
    });
  }

  private navigateForNotification(notification: Notification): void {
    const route = this.getNotificationRoute(notification);
    if (route) void this.router.navigate(route);
  }

  private getNotificationRoute(notification: Notification): string[] | null {
    const id = notification.referenceId;
    switch ((notification.referenceType || '').toUpperCase()) {
      case 'BOOKING': return id ? ['/booking/detail', id] : ['/booking/history'];
      case 'FRIENDSHIP': return ['/friends'];
      case 'MESSAGE': return ['/chat'];
      case 'CLUB': return id ? ['/clubs', id] : ['/clubs'];
      case 'CLUB_DISBANDED': return ['/clubs'];
      case 'TOURNAMENT': return id ? ['/tournaments', id] : ['/tournaments'];
      case 'MATCHMAKING_SESSION': return ['/matchmaking'];
      default: return null;
    }
  }

  private addPending(id: string): void {
    this.pendingIds.update(current => new Set([...current, id]));
  }

  private removePending(id: string): void {
    this.pendingIds.update(current => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }
}
