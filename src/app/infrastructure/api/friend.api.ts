import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Friendship,
  SendFriendRequestPayload,
  RespondFriendRequestPayload,
  UserBlock,
  BlockUserPayload
} from '@application/dto/friend/friend.dto';
import { BaseResponse } from '@application/dto/base/base-response';
import { API_ENDPOINTS } from '@infrastructure/config/api-endpoints';
import {
  CURRENT_USER_PROVIDER_TOKEN,
  CurrentUserProvider
} from '@application/ports/current-user.provider';

@Injectable({
  providedIn: 'root'
})
export class FriendApi {
  private http = inject(HttpClient);
  private currentUser = inject<CurrentUserProvider>(CURRENT_USER_PROVIDER_TOKEN);
  private readonly apiBase = `${API_ENDPOINTS.social}/friends`;
  private readonly blockApiBase = `${API_ENDPOINTS.social}/blocks`;

  getFriends(): Observable<BaseResponse<Friendship[]>> {
    return this.http.get<BaseResponse<Friendship[]>>(
      this.apiBase,
      { params: this.currentUserParams() }
    );
  }

  getPendingReceived(): Observable<BaseResponse<Friendship[]>> {
    return this.http.get<BaseResponse<Friendship[]>>(
      `${this.apiBase}/requests/received`,
      { params: this.currentUserParams() }
    );
  }

  getPendingSent(): Observable<BaseResponse<Friendship[]>> {
    return this.http.get<BaseResponse<Friendship[]>>(
      `${this.apiBase}/requests/sent`,
      { params: this.currentUserParams() }
    );
  }

  sendFriendRequest(payload: SendFriendRequestPayload): Observable<BaseResponse<Friendship>> {
    return this.http.post<BaseResponse<Friendship>>(
      `${this.apiBase}/requests`,
      {
        requesterId: this.requireCurrentUserId(),
        addresseeId: payload.targetUserId
      }
    );
  }

  respondFriendRequest(friendshipId: string, payload: RespondFriendRequestPayload): Observable<BaseResponse<Friendship>> {
    return this.http.put<BaseResponse<Friendship>>(
      `${this.apiBase}/requests/${friendshipId}/respond`,
      {
        actorUserId: this.requireCurrentUserId(),
        accepted: payload.accepted
      }
    );
  }

  unfriend(friendshipId: string): Observable<BaseResponse<void>> {
    return this.http.delete<BaseResponse<void>>(
      `${this.apiBase}/${friendshipId}`,
      { params: this.currentUserParams() }
    );
  }

  getBlockedUsers(): Observable<BaseResponse<UserBlock[]>> {
    return this.http.get<BaseResponse<UserBlock[]>>(
      this.blockApiBase,
      { params: this.currentUserParams() }
    );
  }

  blockUser(payload: BlockUserPayload): Observable<BaseResponse<UserBlock>> {
    return this.http.post<BaseResponse<UserBlock>>(
      this.blockApiBase,
      {
        blockerId: this.requireCurrentUserId(),
        blockedUserId: payload.blockedUserId,
        reason: payload.reason
      }
    );
  }

  unblockUser(blockId: string): Observable<BaseResponse<void>> {
    return this.http.delete<BaseResponse<void>>(
      `${this.blockApiBase}/${blockId}`,
      { params: new HttpParams().set('actorUserId', this.requireCurrentUserId()) }
    );
  }

  private currentUserParams(): HttpParams {
    return new HttpParams().set('userId', this.requireCurrentUserId());
  }

  private requireCurrentUserId(): string {
    const userId = this.currentUser.getCurrentUserId();
    if (!userId) {
      throw new Error('Không tìm thấy phiên đăng nhập hiện tại.');
    }
    return userId;
  }
}
