import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, EMPTY, Observable, Subscription } from 'rxjs';
import { distinctUntilChanged, map, tap } from 'rxjs/operators';
import {
  Notification,
  NotificationPage,
  NotificationQuery,
  NotificationStatus
} from '@application/dto/notification/notification.dto';
import { GetNotificationsUseCase } from '@application/usecase/notification/get-notifications.usecase';
import { CountUnreadNotificationsUseCase } from '@application/usecase/notification/count-unread-notifications.usecase';
import { MarkNotificationReadUseCase } from '@application/usecase/notification/mark-notification-read.usecase';
import { MarkAllNotificationsReadUseCase } from '@application/usecase/notification/mark-all-notifications-read.usecase';
import { DeleteNotificationUseCase } from '@application/usecase/notification/delete-notification.usecase';
import { WEBSOCKET_SERVICE_TOKEN } from '@application/ports/websocket.service';
import { AuthService } from './auth.service';
import { SessionStateService } from './session-state.service';
import { NotifyService } from '@shared/components/notify/notify.service';

export interface NotificationPageState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  status: NotificationStatus | null;
}

const EMPTY_PAGE_STATE: NotificationPageState = {
  page: 0,
  pageSize: 10,
  total: 0,
  totalPages: 0,
  status: null
};

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private readonly getNotificationsUseCase = inject(GetNotificationsUseCase);
  private readonly countUnreadUseCase = inject(CountUnreadNotificationsUseCase);
  private readonly markReadUseCase = inject(MarkNotificationReadUseCase);
  private readonly markAllReadUseCase = inject(MarkAllNotificationsReadUseCase);
  private readonly deleteNotificationUseCase = inject(DeleteNotificationUseCase);
  private readonly wsService = inject(WEBSOCKET_SERVICE_TOKEN);
  private readonly authService = inject(AuthService);
  private readonly notify = inject(NotifyService);
  private readonly ngZone = inject(NgZone);
  private readonly sessionStateService = inject(SessionStateService);

  private readonly notificationsSubject = new BehaviorSubject<Notification[]>([]);
  readonly notifications$ = this.notificationsSubject.asObservable();

  private readonly recentNotificationsSubject = new BehaviorSubject<Notification[]>([]);
  readonly recentNotifications$ = this.recentNotificationsSubject.asObservable();

  private readonly unreadCountSubject = new BehaviorSubject<number>(0);
  readonly unreadCount$ = this.unreadCountSubject.asObservable();

  private readonly allCountSubject = new BehaviorSubject<number>(0);
  readonly allCount$ = this.allCountSubject.asObservable();

  private readonly pageStateSubject = new BehaviorSubject<NotificationPageState>(EMPTY_PAGE_STATE);
  readonly pageState$ = this.pageStateSubject.asObservable();

  private wsSubscription: Subscription | null = null;
  private userSubscription: Subscription | null = null;
  private activeStatus: NotificationStatus | null = null;
  private activeUserId: string | null = null;
  private notificationRequestSequence = 0;

  constructor() {
    this.monitorUserSession();
  }

  get pageState(): NotificationPageState {
    return this.pageStateSubject.value;
  }

  fetchNotifications(query: NotificationQuery, append = false): Observable<NotificationPage> {
    const normalizedQuery: NotificationQuery = {
      status: query.status,
      page: Math.max(1, query.page),
      pageSize: Math.max(1, query.pageSize)
    };
    const requestedStatus = normalizedQuery.status ?? null;
    const requestedUserId = this.activeUserId;
    const requestSequence = ++this.notificationRequestSequence;
    this.activeStatus = requestedStatus;
    if (!append) {
      this.notificationsSubject.next([]);
      this.pageStateSubject.next({
        page: 0,
        pageSize: normalizedQuery.pageSize,
        total: 0,
        totalPages: 0,
        status: requestedStatus
      });
    }

    return this.getNotificationsUseCase.execute(normalizedQuery).pipe(
      tap(page => {
        if (
          requestSequence !== this.notificationRequestSequence ||
          this.activeStatus !== requestedStatus ||
          this.activeUserId !== requestedUserId
        ) return;

        const items = this.mergeNotifications(page.items, this.notificationsSubject.value);

        this.notificationsSubject.next(items);
        this.pageStateSubject.next({
          page: page.page,
          pageSize: page.pageSize,
          total: page.total,
          totalPages: page.totalPages,
          status: requestedStatus
        });

        if (!requestedStatus) {
          this.allCountSubject.next(page.total);
          if (normalizedQuery.page === 1) {
            this.recentNotificationsSubject.next(items.slice(0, 5));
          }
        }
      })
    );
  }

  fetchUnreadCount(): Observable<number> {
    const requestedUserId = this.activeUserId;
    return this.countUnreadUseCase.execute().pipe(
      tap(count => {
        if (requestedUserId === this.activeUserId) {
          this.unreadCountSubject.next(count);
        }
      })
    );
  }

  markAsRead(id: string): Observable<Notification> {
    const notification = this.findNotification(id);
    if (!notification || notification.status !== NotificationStatus.UNREAD) {
      return EMPTY;
    }

    return this.markReadUseCase.execute(id).pipe(
      tap(updated => {
        const readNotification: Notification = {
          ...notification,
          ...updated,
          status: NotificationStatus.READ,
          readAt: updated?.readAt || new Date().toISOString()
        };

        if (this.activeStatus === NotificationStatus.UNREAD) {
          this.notificationsSubject.next(
            this.notificationsSubject.value.filter(item => item.notificationId !== id)
          );
          this.decreaseVisibleTotal();
        } else {
          this.notificationsSubject.next(
            this.notificationsSubject.value.map(item =>
              item.notificationId === id ? readNotification : item
            )
          );
        }

        this.recentNotificationsSubject.next(
          this.recentNotificationsSubject.value.map(item =>
            item.notificationId === id ? readNotification : item
          )
        );

        this.unreadCountSubject.next(Math.max(0, this.unreadCountSubject.value - 1));
      })
    );
  }

  markAllRead(): Observable<void> {
    return this.markAllReadUseCase.execute().pipe(
      tap(() => {
        if (this.activeStatus === NotificationStatus.UNREAD) {
          this.notificationsSubject.next([]);
          this.pageStateSubject.next({
            ...this.pageStateSubject.value,
            page: 0,
            total: 0,
            totalPages: 0
          });
        } else {
          const readAt = new Date().toISOString();
          this.notificationsSubject.next(
            this.notificationsSubject.value.map(item => ({
              ...item,
              status: NotificationStatus.READ,
              readAt: item.readAt || readAt
            }))
          );
        }
        const readAt = new Date().toISOString();
        this.recentNotificationsSubject.next(
          this.recentNotificationsSubject.value.map(item => ({
            ...item,
            status: NotificationStatus.READ,
            readAt: item.readAt || readAt
          }))
        );
        this.unreadCountSubject.next(0);
      })
    );
  }

  deleteNotification(id: string): Observable<void> {
    const notification = this.findNotification(id);

    return this.deleteNotificationUseCase.execute(id).pipe(
      tap(() => {
        this.notificationsSubject.next(
          this.notificationsSubject.value.filter(item => item.notificationId !== id)
        );
        this.recentNotificationsSubject.next(
          this.recentNotificationsSubject.value.filter(item => item.notificationId !== id)
        );
        this.allCountSubject.next(Math.max(0, this.allCountSubject.value - 1));
        this.decreaseVisibleTotal();

        if (notification?.status === NotificationStatus.UNREAD) {
          this.unreadCountSubject.next(Math.max(0, this.unreadCountSubject.value - 1));
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
    this.disconnectWebSocket();
  }

  private monitorUserSession(): void {
    this.userSubscription = this.authService.currentUser$.pipe(
      map(user => user?.userId ?? null),
      distinctUntilChanged()
    ).subscribe(userId => {
      this.activeUserId = userId;
      this.disconnectWebSocket();
      this.clearNotifications();

      if (!userId) return;

      this.fetchUnreadCount().subscribe({ error: () => undefined });
      this.loadRecentNotifications(userId);
      this.connectWebSocket();
    });
  }

  private connectWebSocket(): void {
    this.wsService.connect();
    this.wsSubscription = this.wsService.notifications$.subscribe(notification => {
      this.ngZone.run(() => this.handleRealTimeNotification(notification));
    });
  }

  private disconnectWebSocket(): void {
    this.wsSubscription?.unsubscribe();
    this.wsSubscription = null;
    this.wsService.disconnect();
  }

  private clearNotifications(): void {
    this.notificationRequestSequence++;
    this.activeStatus = null;
    this.notificationsSubject.next([]);
    this.recentNotificationsSubject.next([]);
    this.unreadCountSubject.next(0);
    this.allCountSubject.next(0);
    this.pageStateSubject.next(EMPTY_PAGE_STATE);
  }

  private handleRealTimeNotification(notification: Notification): void {
    const currentUserId = this.sessionStateService.getCurrentUserId();
    if (!currentUserId || notification.receiverId !== currentUserId) return;
    if (this.findNotification(notification.notificationId)) return;

    const isUnread = notification.status === NotificationStatus.UNREAD;
    const matchesCurrentFilter = !this.activeStatus || (this.activeStatus === NotificationStatus.UNREAD && isUnread);

    if (matchesCurrentFilter) {
      this.notificationsSubject.next(
        this.sortNotifications([notification, ...this.notificationsSubject.value])
      );
      const state = this.pageStateSubject.value;
      const total = state.total + 1;
      this.pageStateSubject.next({
        ...state,
        total,
        totalPages: Math.ceil(total / state.pageSize)
      });
    }

    this.recentNotificationsSubject.next(
      this.sortNotifications([notification, ...this.recentNotificationsSubject.value]).slice(0, 5)
    );

    this.allCountSubject.next(this.allCountSubject.value + 1);
    if (isUnread) {
      this.unreadCountSubject.next(this.unreadCountSubject.value + 1);
    }
    this.notify.info(notification.content, notification.title);
  }

  private decreaseVisibleTotal(): void {
    const state = this.pageStateSubject.value;
    const total = Math.max(0, state.total - 1);
    this.pageStateSubject.next({
      ...state,
      total,
      totalPages: total ? Math.ceil(total / state.pageSize) : 0
    });
  }

  private loadRecentNotifications(requestedUserId: string): void {
    this.getNotificationsUseCase.execute({ page: 1, pageSize: 5 }).subscribe({
      next: page => {
        if (requestedUserId !== this.activeUserId) return;
        this.recentNotificationsSubject.next(this.sortNotifications(page.items).slice(0, 5));
        this.allCountSubject.next(page.total);
      },
      error: () => undefined
    });
  }

  private findNotification(id: string): Notification | undefined {
    return this.notificationsSubject.value.find(item => item.notificationId === id)
      ?? this.recentNotificationsSubject.value.find(item => item.notificationId === id);
  }

  private mergeNotifications(incoming: Notification[], current: Notification[]): Notification[] {
    const merged = new Map<string, Notification>();
    [...incoming, ...current].forEach(item => merged.set(item.notificationId, item));
    return this.sortNotifications([...merged.values()]);
  }

  private sortNotifications(items: Notification[]): Notification[] {
    return [...items].sort((a, b) => this.toTimestamp(b.createdAt) - this.toTimestamp(a.createdAt));
  }

  private toTimestamp(value: string): number {
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }
}
