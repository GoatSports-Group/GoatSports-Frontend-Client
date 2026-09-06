import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ChatRoom,
  ChatMessage,
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
}

export const CHAT_REPOSITORY_TOKEN = new InjectionToken<ChatRepository>('CHAT_REPOSITORY_TOKEN');
