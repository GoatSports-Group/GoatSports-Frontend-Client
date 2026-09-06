import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Notification } from '@domain/entities/notification';
import { NotificationPage, NotificationQuery } from '@application/dto/notification/notification.dto';

export interface NotificationRepository {
  getNotifications(query: NotificationQuery): Observable<NotificationPage>;
  getUnreadCount(): Observable<number>;
  markAsRead(id: string): Observable<Notification>;
  markAllRead(): Observable<void>;
  deleteNotification(id: string): Observable<void>;
}

export const NOTIFICATION_REPOSITORY_TOKEN = new InjectionToken<NotificationRepository>('NotificationRepository');
