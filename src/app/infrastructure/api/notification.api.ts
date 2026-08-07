import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Notification } from '@domain/entities/notification';
import { BaseResponse } from '@application/dto/base/base-response';
import { environment } from '@environments/environment';

export interface NotificationListResponse {
  meta: {
    page: number;
    pageSize: number;
    pages: number;
    total: number;
  };
  result: Notification[];
}

@Injectable({
  providedIn: 'root'
})
export class NotificationApi {
  private http = inject(HttpClient);
  private apiBase = environment.apiUrl;

  getNotifications(): Observable<BaseResponse<NotificationListResponse>> {
    return this.http.get<BaseResponse<NotificationListResponse>>(
      `${this.apiBase}/notification-service/api/v1/notifications`
    );
  }

  getUnreadCount(): Observable<BaseResponse<number>> {
    return this.http.get<BaseResponse<number>>(
      `${this.apiBase}/notification-service/api/v1/notifications/unread-count`
    );
  }

  markAsRead(id: string): Observable<BaseResponse<Notification>> {
    return this.http.put<BaseResponse<Notification>>(
      `${this.apiBase}/notification-service/api/v1/notifications/${id}/read`,
      {}
    );
  }
}
