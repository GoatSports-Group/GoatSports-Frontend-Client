import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { NotificationRepository } from '@application/ports/persistence/notification.repository';
import { Notification } from '@domain/entities/notification';
import { NotificationApi } from '@infrastructure/api/notification.api';
import { NotificationPage, NotificationQuery } from '@application/dto/notification/notification.dto';

@Injectable({
  providedIn: 'root'
})
export class NotificationRepositoryImpl implements NotificationRepository {
  private notificationApi = inject(NotificationApi);

  getNotifications(query: NotificationQuery): Observable<NotificationPage> {
    return this.notificationApi.getNotifications(query).pipe(
      map(response => ({
        items: response.data?.result ?? [],
        total: response.data?.meta?.total ?? 0,
        page: response.data?.meta?.page ?? query.page,
        pageSize: response.data?.meta?.pageSize ?? query.pageSize,
        totalPages: response.data?.meta?.pages ?? 0
      }))
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
