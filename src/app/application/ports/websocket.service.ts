import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Notification } from '@domain/entities/notification';
import { ChatMessage, ChatTypingEvent } from '@application/dto/chat/chat.dto';
import { OwnerApplicationProgressChangedEvent } from '@application/dto/owner-application/owner-application-progress.dto';

export interface WebSocketService {
  notifications$: Observable<Notification>;
  ownerApplicationProgress$: Observable<OwnerApplicationProgressChangedEvent>;
  chatMessages$: Observable<ChatMessage>;
  typingEvents$: Observable<ChatTypingEvent>;
  connect(): void;
  disconnect(): void;
  subscribeToRoom(roomId: string): void;
  unsubscribeFromRoom(roomId: string): void;
  sendChatMessage(payload: any): void;
  sendTyping(roomId: string, senderName: string, isTyping: boolean): void;
}

export const WEBSOCKET_SERVICE_TOKEN = new InjectionToken<WebSocketService>('WebSocketService');
