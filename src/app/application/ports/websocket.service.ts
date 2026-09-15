import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Notification } from '@domain/entities/notification';
import { ChatMessage, ChatPresenceEvent, ChatTypingEvent } from '@application/dto/chat/chat.dto';

export interface WebSocketService {
  notifications$: Observable<Notification>;
  chatMessages$: Observable<ChatMessage>;
  typingEvents$: Observable<ChatTypingEvent>;
  presenceEvents$: Observable<ChatPresenceEvent>;
  connect(): void;
  disconnect(): void;
  subscribeToRoom(roomId: string): void;
  unsubscribeFromRoom(roomId: string): void;
  sendChatMessage(payload: any): void;
  sendTyping(roomId: string, senderName: string, isTyping: boolean): void;
}

export const WEBSOCKET_SERVICE_TOKEN = new InjectionToken<WebSocketService>('WebSocketService');
