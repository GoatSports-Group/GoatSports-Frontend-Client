import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Notification } from '@domain/entities/notification';

export interface NotificationRepository {
  getNotifications(): Observable<Notification[]>;
  getUnreadCount(): Observable<number>;
  markAsRead(id: string): Observable<Notification>;
  markAllRead(): Observable<void>;
}

export const NOTIFICATION_REPOSITORY_TOKEN = new InjectionToken<NotificationRepository>('NotificationRepository');
