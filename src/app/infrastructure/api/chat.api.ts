import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ChatRoom,
  ChatMessage,
  CreateDirectRoomRequest,
  CreateGroupRoomRequest,
  SendMessageRequest
} from '@application/dto/chat/chat.dto';
import { BaseResponse, SpringPageResponse } from '@application/dto/base/base-response';
import { API_ENDPOINTS } from '@infrastructure/config/api-endpoints';
import {
  CURRENT_USER_PROVIDER_TOKEN,
  CurrentUserProvider
} from '@application/ports/current-user.provider';

interface ConversationApiResponse {
  conversationId: string;
  type: ChatRoom['type'];
  name?: string;
  avatarUrl?: string;
  lastMessageContent?: string;
  lastMessageAt?: string;
  lastSenderId?: string;
  unreadCount?: number;
  members?: Array<{ userId: string }>;
  createdAt: string;
  updatedAt: string;
}

interface MessageApiResponse {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  content: string;
  type: ChatMessage['type'];
  status?: string;
  attachments?: unknown[];
  sentAt: string;
  editedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatApi {
  private http = inject(HttpClient);
  private currentUser = inject<CurrentUserProvider>(CURRENT_USER_PROVIDER_TOKEN);
  private readonly apiBase = `${API_ENDPOINTS.social}/conversations`;

  getUserRooms(page: number = 0, size: number = 20): Observable<BaseResponse<ChatRoom[]>> {
    const params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    return this.http.get<BaseResponse<SpringPageResponse<ConversationApiResponse>>>(
      this.apiBase,
      { params: params.set('userId', this.requireCurrentUserId()) }
    ).pipe(
      map(response => ({
        ...response,
        data: response.data?.content.map(item => this.toChatRoom(item)) || []
      }))
    );
  }

  getOrCreateDirectRoom(request: CreateDirectRoomRequest): Observable<BaseResponse<ChatRoom>> {
    let params = new HttpParams()
      .set('user1Id', this.requireCurrentUserId())
      .set('user1Name', this.currentUser.getCurrentUserName() || 'Người chơi GoatSports')
      .set('user2Id', request.targetUserId)
      .set('user2Name', request.targetUserName || 'Người chơi GoatSports');

    const user1Avatar = this.currentUser.getCurrentUserAvatar();
    if (user1Avatar) params = params.set('user1Avatar', user1Avatar);
    if (request.targetUserAvatar) params = params.set('user2Avatar', request.targetUserAvatar);

    return this.http.post<BaseResponse<ConversationApiResponse>>(
      `${this.apiBase}/direct`,
      null,
      { params }
    ).pipe(map(response => ({ ...response, data: this.toChatRoom(response.data) })));
  }

  createGroupRoom(request: CreateGroupRoomRequest): Observable<BaseResponse<ChatRoom>> {
    return this.http.post<BaseResponse<ConversationApiResponse>>(
      `${this.apiBase}/group`,
      {
        type: 'GROUP',
        name: request.name,
        avatarUrl: request.avatarUrl,
        creatorId: this.requireCurrentUserId(),
        members: request.participantIds.map(userId => ({ userId }))
      }
    ).pipe(map(response => ({ ...response, data: this.toChatRoom(response.data) })));
  }

  getRoomDetails(roomId: string): Observable<BaseResponse<ChatRoom>> {
    const params = new HttpParams().set('userId', this.requireCurrentUserId());
    return this.http.get<BaseResponse<ConversationApiResponse>>(
      `${this.apiBase}/${roomId}`,
      { params }
    ).pipe(map(response => ({ ...response, data: this.toChatRoom(response.data) })));
  }

  getRoomMessages(roomId: string, page: number = 0, size: number = 50): Observable<BaseResponse<ChatMessage[]>> {
    let params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    params = params.set('userId', this.requireCurrentUserId());
    return this.http.get<BaseResponse<SpringPageResponse<MessageApiResponse>>>(
      `${this.apiBase}/${roomId}/messages`,
      { params }
    ).pipe(
      map(response => ({
        ...response,
        data: response.data?.content.map(item => this.toChatMessage(item)) || []
      }))
    );
  }

  sendMessage(roomId: string, request: SendMessageRequest): Observable<BaseResponse<ChatMessage>> {
    return this.http.post<BaseResponse<MessageApiResponse>>(
      `${this.apiBase}/${roomId}/messages`,
      {
        senderId: this.requireCurrentUserId(),
        senderName: this.currentUser.getCurrentUserName(),
        senderAvatar: this.currentUser.getCurrentUserAvatar(),
        content: request.content,
        type: request.type || 'TEXT'
      }
    ).pipe(map(response => ({ ...response, data: this.toChatMessage(response.data) })));
  }

  markRoomAsRead(roomId: string): Observable<BaseResponse<void>> {
    return this.http.put<BaseResponse<void>>(
      `${this.apiBase}/${roomId}/read`,
      {},
      { params: new HttpParams().set('userId', this.requireCurrentUserId()) }
    );
  }

  private requireCurrentUserId(): string {
    const userId = this.currentUser.getCurrentUserId();
    if (!userId) {
      throw new Error('Không tìm thấy phiên đăng nhập hiện tại.');
    }
    return userId;
  }

  private toChatRoom(item: ConversationApiResponse): ChatRoom {
    return {
      roomId: item.conversationId,
      type: item.type,
      name: item.name,
      avatarUrl: item.avatarUrl,
      participantIds: item.members?.map(member => member.userId) || [],
      lastMessage: item.lastMessageContent,
      lastMessageAt: item.lastMessageAt,
      lastSenderId: item.lastSenderId,
      unreadCount: item.unreadCount || 0,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }

  private toChatMessage(item: MessageApiResponse): ChatMessage {
    return {
      messageId: item.messageId,
      roomId: item.conversationId,
      senderId: item.senderId,
      senderName: item.senderName,
      senderAvatar: item.senderAvatar,
      content: item.content,
      type: item.type,
      metadata: item.attachments?.length ? JSON.stringify(item.attachments) : undefined,
      isRead: item.status === 'READ',
      createdAt: item.sentAt
    };
  }
}
