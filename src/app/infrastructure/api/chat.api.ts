import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ChatRoom,
  ChatMessage,
  CreateDirectRoomRequest,
  CreateGroupRoomRequest,
  SendMessageRequest
} from '@application/dto/chat/chat.dto';
import { BaseResponse } from '@application/dto/base/base-response';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ChatApi {
  private http = inject(HttpClient);
  private apiBase = environment.apiUrl;

  getUserRooms(page: number = 0, size: number = 20): Observable<BaseResponse<ChatRoom[]>> {
    const params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    return this.http.get<BaseResponse<ChatRoom[]>>(
      `${this.apiBase}/notification-service/api/v1/chat/rooms`,
      { params }
    );
  }

  getOrCreateDirectRoom(request: CreateDirectRoomRequest): Observable<BaseResponse<ChatRoom>> {
    return this.http.post<BaseResponse<ChatRoom>>(
      `${this.apiBase}/notification-service/api/v1/chat/rooms/direct`,
      request
    );
  }

  createGroupRoom(request: CreateGroupRoomRequest): Observable<BaseResponse<ChatRoom>> {
    return this.http.post<BaseResponse<ChatRoom>>(
      `${this.apiBase}/notification-service/api/v1/chat/rooms/group`,
      request
    );
  }

  getRoomDetails(roomId: string): Observable<BaseResponse<ChatRoom>> {
    return this.http.get<BaseResponse<ChatRoom>>(
      `${this.apiBase}/notification-service/api/v1/chat/rooms/${roomId}`
    );
  }

  getRoomMessages(roomId: string, page: number = 0, size: number = 50): Observable<BaseResponse<ChatMessage[]>> {
    const params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    return this.http.get<BaseResponse<ChatMessage[]>>(
      `${this.apiBase}/notification-service/api/v1/chat/rooms/${roomId}/messages`,
      { params }
    );
  }

  sendMessage(roomId: string, request: SendMessageRequest): Observable<BaseResponse<ChatMessage>> {
    return this.http.post<BaseResponse<ChatMessage>>(
      `${this.apiBase}/notification-service/api/v1/chat/rooms/${roomId}/messages`,
      request
    );
  }

  markRoomAsRead(roomId: string): Observable<BaseResponse<void>> {
    return this.http.put<BaseResponse<void>>(
      `${this.apiBase}/notification-service/api/v1/chat/rooms/${roomId}/read`,
      {}
    );
  }
}
