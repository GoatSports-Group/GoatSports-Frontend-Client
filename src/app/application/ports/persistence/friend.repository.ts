import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Friendship,
  SendFriendRequestPayload,
  RespondFriendRequestPayload
} from '@application/dto/friend/friend.dto';
import { UserBlock, BlockUserPayload } from '@application/dto/friend/friend.dto';
import { BaseResponse } from '@application/dto/base/base-response';

export interface FriendRepository {
  getFriends(): Observable<BaseResponse<Friendship[]>>;
  getPendingReceived(): Observable<BaseResponse<Friendship[]>>;
  getPendingSent(): Observable<BaseResponse<Friendship[]>>;
  sendFriendRequest(request: SendFriendRequestPayload): Observable<BaseResponse<Friendship>>;
  respondFriendRequest(friendshipId: string, payload: RespondFriendRequestPayload): Observable<BaseResponse<Friendship>>;
  unfriend(friendshipId: string): Observable<BaseResponse<void>>;
  getBlockedUsers(): Observable<BaseResponse<UserBlock[]>>;
  blockUser(payload: BlockUserPayload): Observable<BaseResponse<UserBlock>>;
  unblockUser(blockId: string): Observable<BaseResponse<void>>;
}

export const FRIEND_REPOSITORY_TOKEN = new InjectionToken<FriendRepository>('FRIEND_REPOSITORY_TOKEN');
