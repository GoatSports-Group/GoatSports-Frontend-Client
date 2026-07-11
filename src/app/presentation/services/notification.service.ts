import { Injectable, inject, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { Notification, NotificationStatus } from '@application/dto/notification/notification.dto';
import { GetNotificationsUseCase } from '@application/usecase/notification/get-notifications.usecase';
import { CountUnreadNotificationsUseCase } from '@application/usecase/notification/count-unread-notifications.usecase';
import { MarkNotificationReadUseCase } from '@application/usecase/notification/mark-notification-read.usecase';
import { WEBSOCKET_SERVICE_TOKEN } from '@application/ports/websocket.service';
import { AuthService } from './auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SessionStateService } from './session-state.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private getNotificationsUseCase = inject(GetNotificationsUseCase);
  private countUnreadUseCase = inject(CountUnreadNotificationsUseCase);
  private markReadUseCase = inject(MarkNotificationReadUseCase);
  private wsService = inject(WEBSOCKET_SERVICE_TOKEN);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private ngZone = inject(NgZone);
  private sessionStateService = inject(SessionStateService);

  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$: Observable<Notification[]> = this.notificationsSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$: Observable<number> = this.unreadCountSubject.asObservable();

  private wsSubscription: Subscription | null = null;
  private userSubscription: Subscription | null = null;

  constructor() {
    this.monitorUserSession();
  }

  private monitorUserSession(): void {
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      if (user) {
        console.log('User is authenticated. Initializing Notification Service...');
        this.loadInitialData();
        this.connectWebSocket();
      } else {
        this.disconnectWebSocket();
        this.clearNotifications();
      }
    });
  }

  private loadInitialData(): void {
    this.fetchNotifications().subscribe();
    this.fetchUnreadCount().subscribe();
  }

  private connectWebSocket(): void {
    this.wsService.connect();

    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
    }

    this.wsSubscription = this.wsService.notifications$.subscribe({
      next: (notification) => {
        this.ngZone.run(() => {
          this.handleRealTimeNotification(notification);
        });
      },
      error: (err) => {
        console.error('Error in WebSocket notification channel:', err);
      }
    });
  }

  private disconnectWebSocket(): void {
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
      this.wsSubscription = null;
    }
    this.wsService.disconnect();
  }

  private clearNotifications(): void {
    this.notificationsSubject.next([]);
    this.unreadCountSubject.next(0);
  }

  private handleRealTimeNotification(notification: Notification): void {
    const currentUserId = this.sessionStateService.getCurrentUser()?.userId;
    if (notification.receiverId && notification.receiverId !== currentUserId) {
      console.log('Ignore websocket notification meant for another user.');
      return;
    }

    // Add to the top of notifications list
    const current = this.notificationsSubject.value;
    // Prevent duplicate entries in memory if the list is reloaded
    if (!current.some(n => n.notificationId === notification.notificationId)) {
      this.notificationsSubject.next([notification, ...current]);
      this.unreadCountSubject.next(this.unreadCountSubject.value + 1);
    }

    // Display Snack Bar Toast
    this.snackBar.open(`${notification.title}: ${notification.content}`, 'Đóng', {
      duration: 6000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['snackbar-info']
    });
  }

  public fetchNotifications(): Observable<Notification[]> {
    return new Observable<Notification[]>(subscriber => {
      this.getNotificationsUseCase.execute().subscribe({
        next: (notifications) => {
          // Sort descending by createdAt
          notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          this.notificationsSubject.next(notifications);
          subscriber.next(notifications);
          subscriber.complete();
        },
        error: (err) => {
          console.error('Failed to load notifications history:', err);
          subscriber.error(err);
        }
      });
    });
  }

  public fetchUnreadCount(): Observable<number> {
    return new Observable<number>(subscriber => {
      this.countUnreadUseCase.execute().subscribe({
        next: (count) => {
          this.unreadCountSubject.next(count);
          subscriber.next(count);
          subscriber.complete();
        },
        error: (err) => {
          console.error('Failed to get unread notification count:', err);
          subscriber.error(err);
        }
      });
    });
  }

  public markAsRead(id: string): Observable<Notification> {
    return new Observable<Notification>(subscriber => {
      this.markReadUseCase.execute(id).subscribe({
        next: (updated) => {
          // Update local status
          const current = this.notificationsSubject.value.map(n => {
            if (n.notificationId === id) {
              return { ...n, status: NotificationStatus.READ, readAt: new Date().toISOString() };
            }
            return n;
          });
          this.notificationsSubject.next(current);

          // Decrement count if it was unread
          const count = Math.max(0, this.unreadCountSubject.value - 1);
          this.unreadCountSubject.next(count);

          subscriber.next(updated);
          subscriber.complete();
        },
        error: (err) => {
          console.error('Failed to mark notification as read:', err);
          subscriber.error(err);
        }
      });
    });
  }

  public ngOnDestroy(): void {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    this.disconnectWebSocket();
  }
}
