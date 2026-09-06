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
  contextId?: string;
  lastMessageId?: string;
  lastMessageContent?: string;
  lastMessageAt?: string;
  lastSenderId?: string;
  unreadCount?: number;
  members?: Array<{
    userId: string;
    userName?: string;
    userAvatar?: string;
    role?: string;
    joinedAt?: string;
    lastReadMessageId?: string;
    leftAt?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface MessageApiResponse {
  messageId: string;
  conversationId: string;
  senderId: string;
  clientMessageId?: string;
  senderName?: string;
  senderAvatar?: string;
  content: string;
  type: ChatMessage['type'];
  status?: string;
  replyToMessageId?: string;
  attachments?: ChatMessage['attachments'];
  receipts?: ChatMessage['receipts'];
  deleted?: boolean;
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
      .set('user2Id', request.targetUserId);

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
        members: request.participants.map(participant => ({ userId: participant.userId }))
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
        clientMessageId: request.clientMessageId,
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
    const participants = item.members || [];
    const counterpart = item.type === 'DIRECT'
      ? participants.find(member => member.userId !== this.requireCurrentUserId())
      : undefined;
    return {
      roomId: item.conversationId,
      type: item.type,
      name: counterpart?.userName || item.name,
      avatarUrl: counterpart?.userAvatar || item.avatarUrl,
      contextId: item.contextId,
      lastMessageId: item.lastMessageId,
      participantIds: participants.map(member => member.userId),
      participants,
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
      clientMessageId: item.clientMessageId,
      senderName: item.senderName,
      senderAvatar: item.senderAvatar,
      content: item.content,
      type: item.type,
      status: item.status as ChatMessage['status'],
      replyToMessageId: item.replyToMessageId,
      attachments: item.attachments || [],
      receipts: item.receipts || [],
      deleted: item.deleted,
      isRead: item.status === 'READ',
      createdAt: item.sentAt,
      editedAt: item.editedAt
    };
  }
}
