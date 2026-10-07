import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ChatRepository } from '@application/ports/persistence/chat.repository';
import { ChatApi } from '@infrastructure/api/chat.api';
import {
  ChatRoom,
  ChatMessage,
  ChatMessageWindow,
  ChatPresenceEvent,
  CreateBusinessRoomRequest,
  CreateDirectRoomRequest,
  CreateGroupRoomRequest,
  SendMessageRequest
} from '@application/dto/chat/chat.dto';
import { BaseResponse } from '@application/dto/base/base-response';

@Injectable({
  providedIn: 'root'
})
export class ChatRepositoryImpl implements ChatRepository {
  private api = inject(ChatApi);

  getUserRooms(page?: number, size?: number): Observable<BaseResponse<ChatRoom[]>> {
    return this.api.getUserRooms(page, size);
  }

  getOrCreateDirectRoom(request: CreateDirectRoomRequest): Observable<BaseResponse<ChatRoom>> {
    return this.api.getOrCreateDirectRoom(request);
  }

  getOrCreateBusinessRoom(request: CreateBusinessRoomRequest): Observable<BaseResponse<ChatRoom>> {
    return this.api.getOrCreateBusinessRoom(request);
  }

  createGroupRoom(request: CreateGroupRoomRequest): Observable<BaseResponse<ChatRoom>> {
    return this.api.createGroupRoom(request);
  }

  getRoomDetails(roomId: string): Observable<BaseResponse<ChatRoom>> {
    return this.api.getRoomDetails(roomId);
  }

  getRoomMessages(roomId: string, page?: number, size?: number): Observable<BaseResponse<ChatMessage[]>> {
    return this.api.getRoomMessages(roomId, page, size);
  }

  sendMessage(roomId: string, request: SendMessageRequest): Observable<BaseResponse<ChatMessage>> {
    return this.api.sendMessage(roomId, request);
  }

  getMessagesByCursor(roomId: string, cursor: { before?: string | null; after?: string | null }, size: number): Observable<ChatMessage[]> {
    return this.api.getMessagesByCursor(roomId, cursor, size);
  }

  getUnreadWindow(roomId: string, size: number): Observable<ChatMessageWindow> {
    return this.api.getUnreadWindow(roomId, size);
  }

  markRoomAsRead(roomId: string): Observable<BaseResponse<void>> {
    return this.api.markRoomAsRead(roomId);
  }

  clearRoom(roomId: string): Observable<void> {
    return this.api.clearRoom(roomId);
  }

  setMuted(roomId: string, muted: boolean): Observable<void> {
    return this.api.setMuted(roomId, muted);
  }

  getPresence(userIds: string[]): Observable<BaseResponse<ChatPresenceEvent[]>> {
    return this.api.getPresence(userIds);
  }
}
