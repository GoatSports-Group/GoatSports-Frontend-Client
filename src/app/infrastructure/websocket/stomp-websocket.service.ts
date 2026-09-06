import { Injectable, inject } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { Notification } from '@domain/entities/notification';
import { ChatMessage, ChatTypingEvent } from '@application/dto/chat/chat.dto';
import { WebSocketService } from '@application/ports/websocket.service';
import {
  CURRENT_USER_PROVIDER_TOKEN,
  CurrentUserProvider
} from '@application/ports/current-user.provider';
import { environment } from '@environments/environment';
import { OwnerApplicationProgressChangedEvent } from '@application/dto/workflow/owner-application-progress.dto';

class StompFrame {
  constructor(
    public command: string,
    public headers: Record<string, string>,
    public body: string
  ) { }

  static parse(data: string): StompFrame | null {
    if (!data) return null;
    const raw = data.replace(/\r/g, '');
    const nullIdx = raw.indexOf('\0');
    const content = nullIdx !== -1 ? raw.substring(0, nullIdx) : raw;

    const lines = content.split('\n');
    const command = lines[0].trim();
    if (!command) return null;

    const headers: Record<string, string> = {};
    let lineIdx = 1;
    while (lineIdx < lines.length && lines[lineIdx].trim() !== '') {
      const line = lines[lineIdx];
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const key = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();
        headers[key] = value;
      }
      lineIdx++;
    }

    const body = lines.slice(lineIdx + 1).join('\n');
    return new StompFrame(command, headers, body);
  }

  toString(): string {
    let raw = this.command + '\n';
    for (const key of Object.keys(this.headers)) {
      raw += `${key}:${this.headers[key]}\n`;
    }
    raw += '\n' + this.body + '\0';
    return raw;
  }
}

@Injectable({
  providedIn: 'root'
})
export class StompWebSocketService implements WebSocketService {
  private socket: WebSocket | null = null;
  private socialSocket: WebSocket | null = null;
  private isConnected = false;
  private isSocialConnected = false;
  private reconnectTimeout: any = null;
  private socialReconnectTimeout: any = null;
  private shouldReconnect = false;
  private apiBase = environment.apiUrl;
  private notificationSubscriptionId = 'sub-user-notifications';
  private progressSubscriptionId = 'sub-owner-application-progress';
  private activeRoomSubscriptions = new Set<string>();
  private currentUserProvider = inject<CurrentUserProvider>(CURRENT_USER_PROVIDER_TOKEN);

  private notificationSubject = new Subject<Notification>();
  public notifications$: Observable<Notification> = this.notificationSubject.asObservable();
  private progressSubject = new Subject<OwnerApplicationProgressChangedEvent>();
  public ownerApplicationProgress$ = this.progressSubject.asObservable();
  private chatMessageSubject = new Subject<ChatMessage>();
  public chatMessages$: Observable<ChatMessage> = this.chatMessageSubject.asObservable();
  private typingEventSubject = new Subject<ChatTypingEvent>();
  public typingEvents$: Observable<ChatTypingEvent> = this.typingEventSubject.asObservable();

  constructor() { }

  public connect(): void {
    this.shouldReconnect = true;
    this.connectSocialSocket();
    if (this.socket || this.isConnected) {
      return;
    }

    let wsUrl = this.apiBase.replace(/^http/, 'ws');
    if (!wsUrl.endsWith('/')) {
      wsUrl += '/';
    }
    wsUrl += 'notification-service/ws';

    console.log('Connecting to WebSocket at:', wsUrl);

    try {
      const socket = new WebSocket(wsUrl);
      this.socket = socket;

      socket.onopen = () => {
        if (this.socket !== socket) return;
        console.log('WebSocket connection opened. Sending STOMP CONNECT...');
        this.sendConnectFrame();
      };

      socket.onmessage = (event: MessageEvent) => {
        if (this.socket !== socket) return;
        this.handleMessage(event.data);
      };

      socket.onclose = (event: CloseEvent) => {
        if (this.socket !== socket) return;
        console.log('WebSocket connection closed:', event.reason);
        this.handleDisconnect();
      };

      socket.onerror = (error: Event) => {
        if (this.socket !== socket) return;
        console.error('WebSocket error occurred:', error);
      };
    } catch (err) {
      console.error('Error starting WebSocket connection:', err);
      this.handleDisconnect();
    }
  }

  public disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socialReconnectTimeout) {
      clearTimeout(this.socialReconnectTimeout);
      this.socialReconnectTimeout = null;
    }

    const socket = this.socket;
    if (socket) {
      if (this.isConnected) {
        this.sendUnsubscribeFrame();
      }
      this.socket = null;
      socket.close();
    }
    this.isConnected = false;

    const socialSocket = this.socialSocket;
    if (socialSocket) {
      if (this.isSocialConnected) {
        this.activeRoomSubscriptions.forEach(roomId => {
          this.socialUnsubscribe(`sub-social-room-${roomId}`);
          this.socialUnsubscribe(`sub-social-typing-${roomId}`);
        });
      }
      this.socialSocket = null;
      socialSocket.close();
    }
    this.isSocialConnected = false;
  }

  public subscribeToRoom(roomId: string): void {
    if (!roomId) return;
    if (this.activeRoomSubscriptions.has(roomId)) return;
    this.activeRoomSubscriptions.add(roomId);
    if (this.isSocialConnected) {
      this.socialSubscribe(`sub-social-room-${roomId}`, `/topic/conversations/${roomId}`);
      this.socialSubscribe(`sub-social-typing-${roomId}`, `/topic/conversations/${roomId}/typing`);
    }
  }

  public unsubscribeFromRoom(roomId: string): void {
    if (!roomId) return;
    this.activeRoomSubscriptions.delete(roomId);
    if (this.isSocialConnected) {
      this.socialUnsubscribe(`sub-social-room-${roomId}`);
      this.socialUnsubscribe(`sub-social-typing-${roomId}`);
    }
  }

  public sendChatMessage(payload: any): void {
    if (!this.socialSocket || !this.isSocialConnected) {
      console.warn('Cannot send STOMP message: WebSocket not connected.');
      return;
    }
    const body = {
      conversationId: payload.conversationId || payload.roomId,
      senderId: payload.senderId,
      clientMessageId: payload.clientMessageId || crypto.randomUUID(),
      content: payload.content,
      type: payload.type,
      replyToMessageId: payload.replyToMessageId
    };
    this.sendSocialFrame(new StompFrame('SEND', { destination: '/app/social/chat.send' }, JSON.stringify(body)));
  }

  public sendTyping(roomId: string, senderName: string, isTyping: boolean): void {
    if (!this.socialSocket || !this.isSocialConnected) return;
    const currentUserId = this.currentUserProvider.getCurrentUserId();
    const payload = {
      conversationId: roomId,
      userId: currentUserId,
      userName: senderName || this.currentUserProvider.getCurrentUserName() || 'Người chơi GoatSports',
      typing: isTyping
    };
    this.sendSocialFrame(new StompFrame('SEND', { destination: '/app/social/chat.typing' }, JSON.stringify(payload)));
  }

  private sendConnectFrame(): void {
    if (!this.socket) return;

    const connectFrame = new StompFrame('CONNECT', {
      'accept-version': '1.1,1.2',
      'heart-beat': '10000,10000'
    }, '');

    this.socket.send(connectFrame.toString());
  }

  private sendSubscribeFrame(): void {
    if (!this.socket) return;

    const currentUserId = this.currentUserProvider.getCurrentUserId();
    if (!currentUserId) {
      console.warn('Cannot subscribe to STOMP notifications: No active user session.');
      return;
    }

    this.subscribe(this.notificationSubscriptionId, `/topic/user/notifications/${currentUserId}`);
    this.subscribe(this.progressSubscriptionId, `/topic/user/owner-application-progress/${currentUserId}`);
  }

  private sendUnsubscribeFrame(): void {
    if (!this.socket || !this.isConnected) return;

    try {
      this.unsubscribe(this.notificationSubscriptionId);
      this.unsubscribe(this.progressSubscriptionId);
      console.log('STOMP UNSUBSCRIBE sent');
    } catch (e) {
      console.error('Error sending unsubscribe frame:', e);
    }
  }

  private handleMessage(data: string): void {
    if (data === '\n' || data === '\r\n') {
      return;
    }

    try {
      const frame = StompFrame.parse(data);
      if (!frame) return;

      switch (frame.command) {
        case 'CONNECTED':
          console.log('STOMP CONNECTED successfully.');
          this.isConnected = true;
          this.sendSubscribeFrame();
          break;
        case 'MESSAGE':
          const currentUserId = this.currentUserProvider.getCurrentUserId();
          const destination = frame.headers['destination'];
          if (destination === `/topic/user/notifications/${currentUserId}`) {
            try {
              const notification: Notification = JSON.parse(frame.body);
              this.notificationSubject.next(notification);
            } catch (jsonErr) {
              console.error('Failed to parse STOMP notification:', jsonErr);
            }
          } else if (destination === `/topic/user/owner-application-progress/${currentUserId}`) {
            try {
              this.progressSubject.next(JSON.parse(frame.body));
            } catch (jsonErr) {
              console.error('Failed to parse progress event:', jsonErr);
            }
          }
          break;
        case 'ERROR':
          console.error('STOMP ERROR frame received:', frame.body);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  }

  private subscribe(id: string, destination: string): void {
    if (!this.socket) return;
    this.socket.send(new StompFrame('SUBSCRIBE', { id, destination }, '').toString());
    console.log(`STOMP SUBSCRIBE sent for ${destination}`);
  }

  private unsubscribe(id: string): void {
    this.socket?.send(new StompFrame('UNSUBSCRIBE', { id }, '').toString());
  }

  private handleDisconnect(): void {
    this.isConnected = false;
    this.socket = null;

    if (this.shouldReconnect && !this.reconnectTimeout) {
      console.log('Attempting reconnection in 5 seconds...');
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null;
        this.connect();
      }, 5000);
    }
  }

  private connectSocialSocket(): void {
    if (this.socialSocket || this.isSocialConnected) return;

    let wsUrl = this.apiBase.replace(/^http/, 'ws').replace(/\/+$/, '');
    wsUrl += '/social-service/ws/websocket';

    try {
      const socket = new WebSocket(wsUrl);
      this.socialSocket = socket;

      socket.onmessage = (event: MessageEvent) => {
        if (this.socialSocket !== socket) return;
        this.handleSocialTransportMessage(event.data);
      };
      socket.onclose = () => {
        if (this.socialSocket !== socket) return;
        this.handleSocialDisconnect();
      };
      socket.onerror = () => {
        if (this.socialSocket === socket) {
          console.error('Không thể kết nối WebSocket trò chuyện.');
        }
      };
    } catch {
      this.handleSocialDisconnect();
    }
  }

  private handleSocialTransportMessage(data: string): void {
    if (data === 'o') {
      this.sendSocialFrame(new StompFrame('CONNECT', {
        'accept-version': '1.1,1.2',
        'heart-beat': '0,0'
      }, ''));
      return;
    }
    if (data === 'h' || !data.startsWith('a')) return;

    try {
      const messages = JSON.parse(data.substring(1)) as string[];
      messages.forEach(message => this.handleSocialStompFrame(message));
    } catch (error) {
      console.error('Không thể đọc dữ liệu WebSocket trò chuyện.', error);
    }
  }

  private handleSocialStompFrame(data: string): void {
    const frame = StompFrame.parse(data);
    if (!frame) return;

    if (frame.command === 'CONNECTED') {
      this.isSocialConnected = true;
      this.activeRoomSubscriptions.forEach(roomId => {
        this.socialSubscribe(`sub-social-room-${roomId}`, `/topic/conversations/${roomId}`);
        this.socialSubscribe(`sub-social-typing-${roomId}`, `/topic/conversations/${roomId}/typing`);
      });
      return;
    }
    if (frame.command !== 'MESSAGE') return;

    const destination = frame.headers['destination'] || '';
    const match = destination.match(/^\/topic\/conversations\/([^/]+)(\/typing)?$/);
    if (!match) return;

    try {
      const payload = JSON.parse(frame.body);
      const roomId = match[1];
      if (match[2]) {
        this.typingEventSubject.next({
          roomId,
          senderId: payload.userId,
          senderName: payload.userName,
          isTyping: Boolean(payload.typing)
        });
      } else {
        this.chatMessageSubject.next({
          messageId: payload.messageId,
          roomId: payload.conversationId || roomId,
          senderId: payload.senderId,
          senderName: payload.senderName,
          senderAvatar: payload.senderAvatar,
          content: payload.content,
          type: payload.type,
          status: payload.status,
          clientMessageId: payload.clientMessageId,
          replyToMessageId: payload.replyToMessageId,
          attachments: payload.attachments || [],
          receipts: payload.receipts || [],
          deleted: payload.deleted,
          isRead: payload.status === 'READ',
          createdAt: payload.sentAt,
          editedAt: payload.editedAt
        });
      }
    } catch (error) {
      console.error('Không thể chuyển đổi dữ liệu trò chuyện realtime.', error);
    }
  }

  private sendSocialFrame(frame: StompFrame): void {
    if (!this.socialSocket || this.socialSocket.readyState !== WebSocket.OPEN) return;
    this.socialSocket.send(JSON.stringify([frame.toString()]));
  }

  private socialSubscribe(id: string, destination: string): void {
    this.sendSocialFrame(new StompFrame('SUBSCRIBE', { id, destination }, ''));
  }

  private socialUnsubscribe(id: string): void {
    this.sendSocialFrame(new StompFrame('UNSUBSCRIBE', { id }, ''));
  }

  private handleSocialDisconnect(): void {
    this.isSocialConnected = false;
    this.socialSocket = null;
    if (this.shouldReconnect && !this.socialReconnectTimeout) {
      this.socialReconnectTimeout = setTimeout(() => {
        this.socialReconnectTimeout = null;
        this.connectSocialSocket();
      }, 5000);
    }
  }
}
