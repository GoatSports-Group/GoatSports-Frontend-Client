import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ChatRepository } from '@application/ports/persistence/chat.repository';
import { ChatApi } from '@infrastructure/api/chat.api';
import {
  ChatRoom,
  ChatMessage,
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

  markRoomAsRead(roomId: string): Observable<BaseResponse<void>> {
    return this.api.markRoomAsRead(roomId);
  }
}
