import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Notification } from '@domain/entities/notification';
import { BaseResponse } from '@application/dto/base/base-response';
import { environment } from '@environments/environment';
import { NotificationQuery } from '@application/dto/notification/notification.dto';

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

  getNotifications(query: NotificationQuery): Observable<BaseResponse<NotificationListResponse>> {
    let params = new HttpParams()
      .set('page', Math.max(0, query.page - 1))
      .set('size', query.pageSize);

    if (query.status) {
      params = params.set('filter', `status : '${query.status}'`);
    }

    return this.http.get<BaseResponse<NotificationListResponse>>(
      `${this.apiBase}/notification-service/api/v1/notifications`,
      { params }
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

  markAllRead(): Observable<BaseResponse<void>> {
    return this.http.put<BaseResponse<void>>(
      `${this.apiBase}/notification-service/api/v1/notifications/read-all`,
      {}
    );
  }

  deleteNotification(id: string): Observable<BaseResponse<void>> {
    return this.http.delete<BaseResponse<void>>(
      `${this.apiBase}/notification-service/api/v1/notifications/${id}`
    );
  }
}
