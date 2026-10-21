import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Notification } from '@domain/entities/notification';
import { ChatMessage, ChatPresenceEvent, ChatTypingEvent } from '@application/dto/chat/chat.dto';

export interface WebSocketService {
  notifications$: Observable<Notification>;
  chatMessages$: Observable<ChatMessage>;
  /** Tin moi gui toi minh o moi doan chat chua tat thong bao (kenh rieng, khong can subscribe tung phong). */
  inboxMessages$: Observable<ChatMessage>;
  typingEvents$: Observable<ChatTypingEvent>;
  presenceEvents$: Observable<ChatPresenceEvent>;
  /** Phiên vừa bị thu hồi ở máy chủ (bị khóa / yêu cầu xóa tài khoản): mã lý do, trùng mã lỗi gateway. */
  sessionRevoked$: Observable<string>;
  connect(): void;
  disconnect(): void;
  subscribeToRoom(roomId: string): void;
  unsubscribeFromRoom(roomId: string): void;
  sendChatMessage(payload: any): void;
  sendTyping(roomId: string, isTyping: boolean): void;
}

export const WEBSOCKET_SERVICE_TOKEN = new InjectionToken<WebSocketService>('WebSocketService');
