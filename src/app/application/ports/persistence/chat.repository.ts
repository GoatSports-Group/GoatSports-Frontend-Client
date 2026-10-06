import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ChatRoom,
  ChatMessage,
  ChatPresenceEvent,
  CreateDirectRoomRequest,
  CreateGroupRoomRequest,
  SendMessageRequest
} from '@application/dto/chat/chat.dto';
import { BaseResponse } from '@application/dto/base/base-response';

export interface ChatRepository {
  getUserRooms(page?: number, size?: number): Observable<BaseResponse<ChatRoom[]>>;
  getOrCreateDirectRoom(request: CreateDirectRoomRequest): Observable<BaseResponse<ChatRoom>>;
  createGroupRoom(request: CreateGroupRoomRequest): Observable<BaseResponse<ChatRoom>>;
  getRoomDetails(roomId: string): Observable<BaseResponse<ChatRoom>>;
  getRoomMessages(roomId: string, page?: number, size?: number): Observable<BaseResponse<ChatMessage[]>>;
  sendMessage(roomId: string, request: SendMessageRequest): Observable<BaseResponse<ChatMessage>>;
  markRoomAsRead(roomId: string): Observable<BaseResponse<void>>;
  /** Xoa doan chat phia minh: nguoi khac van giu nguyen; tin moi sau do lam doan chat hien lai. */
  clearRoom(roomId: string): Observable<void>;
  setMuted(roomId: string, muted: boolean): Observable<void>;
  getPresence(userIds: string[]): Observable<BaseResponse<ChatPresenceEvent[]>>;
}

export const CHAT_REPOSITORY_TOKEN = new InjectionToken<ChatRepository>('CHAT_REPOSITORY_TOKEN');
