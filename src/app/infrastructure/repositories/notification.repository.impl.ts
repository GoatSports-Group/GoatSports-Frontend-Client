import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { NotificationRepository } from '@application/ports/persistence/notification.repository';
import { Notification } from '@domain/entities/notification';
import { NotificationApi } from '@infrastructure/api/notification.api';

@Injectable({
  providedIn: 'root'
})
export class NotificationRepositoryImpl implements NotificationRepository {
  private notificationApi = inject(NotificationApi);

  getNotifications(): Observable<Notification[]> {
    return this.notificationApi.getNotifications().pipe(
      map(response => response.data?.result || [])
    );
  }

  getUnreadCount(): Observable<number> {
    return this.notificationApi.getUnreadCount().pipe(
      map(response => response.data ?? 0)
    );
  }

  markAsRead(id: string): Observable<Notification> {
    return this.notificationApi.markAsRead(id).pipe(
      map(response => response.data)
    );
  }

  markAllRead(): Observable<void> {
    return this.notificationApi.markAllRead().pipe(
      map(() => void 0)
    );
  }

  deleteNotification(id: string): Observable<void> {
    return this.notificationApi.deleteNotification(id).pipe(
      map(() => void 0)
    );
  }
}
