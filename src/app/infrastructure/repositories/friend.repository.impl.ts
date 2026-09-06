import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { FriendRepository } from '@application/ports/persistence/friend.repository';
import { FriendApi } from '@infrastructure/api/friend.api';
import {
  Friendship,
  SendFriendRequestPayload,
  RespondFriendRequestPayload
} from '@application/dto/friend/friend.dto';
import { BaseResponse } from '@application/dto/base/base-response';

@Injectable({
  providedIn: 'root'
})
export class FriendRepositoryImpl implements FriendRepository {
  private api = inject(FriendApi);

  getFriends(): Observable<BaseResponse<Friendship[]>> {
    return this.api.getFriends();
  }

  getPendingReceived(): Observable<BaseResponse<Friendship[]>> {
    return this.api.getPendingReceived();
  }

  getPendingSent(): Observable<BaseResponse<Friendship[]>> {
    return this.api.getPendingSent();
  }

  sendFriendRequest(request: SendFriendRequestPayload): Observable<BaseResponse<Friendship>> {
    return this.api.sendFriendRequest(request);
  }

  respondFriendRequest(friendshipId: string, payload: RespondFriendRequestPayload): Observable<BaseResponse<Friendship>> {
    return this.api.respondFriendRequest(friendshipId, payload);
  }

  unfriend(friendshipId: string): Observable<BaseResponse<void>> {
    return this.api.unfriend(friendshipId);
  }
}
