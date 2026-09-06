import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Friendship,
  SendFriendRequestPayload,
  RespondFriendRequestPayload
} from '@application/dto/friend/friend.dto';
import { BaseResponse } from '@application/dto/base/base-response';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FriendApi {
  private http = inject(HttpClient);
  private apiBase = environment.apiUrl;

  getFriends(): Observable<BaseResponse<Friendship[]>> {
    return this.http.get<BaseResponse<Friendship[]>>(
      `${this.apiBase}/notification-service/api/v1/friends`
    );
  }

  getPendingReceived(): Observable<BaseResponse<Friendship[]>> {
    return this.http.get<BaseResponse<Friendship[]>>(
      `${this.apiBase}/notification-service/api/v1/friends/requests/received`
    );
  }

  getPendingSent(): Observable<BaseResponse<Friendship[]>> {
    return this.http.get<BaseResponse<Friendship[]>>(
      `${this.apiBase}/notification-service/api/v1/friends/requests/sent`
    );
  }

  sendFriendRequest(payload: SendFriendRequestPayload): Observable<BaseResponse<Friendship>> {
    return this.http.post<BaseResponse<Friendship>>(
      `${this.apiBase}/notification-service/api/v1/friends/requests`,
      payload
    );
  }

  respondFriendRequest(friendshipId: string, payload: RespondFriendRequestPayload): Observable<BaseResponse<Friendship>> {
    return this.http.put<BaseResponse<Friendship>>(
      `${this.apiBase}/notification-service/api/v1/friends/requests/${friendshipId}/respond`,
      payload
    );
  }

  unfriend(friendId: string): Observable<BaseResponse<void>> {
    return this.http.delete<BaseResponse<void>>(
      `${this.apiBase}/notification-service/api/v1/friends/${friendId}`
    );
  }

  checkStatus(targetUserId: string): Observable<BaseResponse<string>> {
    return this.http.get<BaseResponse<string>>(
      `${this.apiBase}/notification-service/api/v1/friends/status/${targetUserId}`
    );
  }
}
