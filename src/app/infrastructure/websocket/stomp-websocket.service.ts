import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Subject, Observable, Subscription } from 'rxjs';
import { Notification } from '@domain/entities/notification';
import { ChatMessage, ChatPresenceEvent, ChatTypingEvent } from '@application/dto/chat/chat.dto';
import { WebSocketService } from '@application/ports/websocket.service';
import {
  CURRENT_USER_PROVIDER_TOKEN,
  CurrentUserProvider
} from '@application/ports/current-user.provider';
import { environment } from '@environments/environment';

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
  private reconnectAttempts = 0;
  private socialReconnectAttempts = 0;
  private presenceHeartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private notificationHeartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private socialStompHeartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private lastNotificationActivityAt = 0;
  private lastSocialActivityAt = 0;
  private static readonly HEARTBEAT_INTERVAL_MS = 10000;
  private static readonly HEARTBEAT_TIMEOUT_MS = 25000;
  private static readonly RECONNECT_BASE_MS = 2000;
  private static readonly RECONNECT_MAX_MS = 30000;
  private authProbeSubscription: Subscription | null = null;
  private authVerified = false;
  private shouldReconnect = false;
  private apiBase = environment.apiUrl;
  private notificationSubscriptionId = 'sub-user-notifications';
  private activeRoomSubscriptions = new Set<string>();
  private currentUserProvider = inject<CurrentUserProvider>(CURRENT_USER_PROVIDER_TOKEN);
  private http = inject(HttpClient);

  private notificationSubject = new Subject<Notification>();
  public notifications$: Observable<Notification> = this.notificationSubject.asObservable();
  private chatMessageSubject = new Subject<ChatMessage>();
  public chatMessages$: Observable<ChatMessage> = this.chatMessageSubject.asObservable();
  private typingEventSubject = new Subject<ChatTypingEvent>();
  public typingEvents$: Observable<ChatTypingEvent> = this.typingEventSubject.asObservable();
  private presenceEventSubject = new Subject<ChatPresenceEvent>();
  public presenceEvents$: Observable<ChatPresenceEvent> = this.presenceEventSubject.asObservable();

  constructor() { }

  public connect(): void {
    this.shouldReconnect = true;
    if (this.authProbeSubscription) return;
    if ((this.socket || this.isConnected) && (this.socialSocket || this.isSocialConnected)) return;

    if (this.authVerified) {
      this.openAuthenticatedSockets();
      return;
    }

    // WebSocket handshakes cannot use Angular's HTTP interceptor directly. Probe an
    // authenticated endpoint first so an expired HttpOnly access cookie is refreshed
    // before the browser starts either handshake.
    this.authProbeSubscription = this.http.get(
      `${this.apiBase.replace(/\/+$/, '')}/auth-service/api/v1/auth/me`,
      { withCredentials: true }
    ).subscribe({
      next: () => {
        this.authVerified = true;
        if (this.shouldReconnect) this.openAuthenticatedSockets();
      },
      error: () => {
        this.authProbeSubscription = null;
        this.scheduleReconnect();
      },
      complete: () => {
        this.authProbeSubscription = null;
      }
    });
  }

  private openAuthenticatedSockets(): void {
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
        this.lastNotificationActivityAt = Date.now();
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
    this.authVerified = false;
    this.reconnectAttempts = 0;
    this.socialReconnectAttempts = 0;
    this.authProbeSubscription?.unsubscribe();
    this.authProbeSubscription = null;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socialReconnectTimeout) {
      clearTimeout(this.socialReconnectTimeout);
      this.socialReconnectTimeout = null;
    }
    this.stopNotificationHeartbeat();
    this.stopSocialStompHeartbeat();

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
        this.publishPresence(false);
        this.socialUnsubscribe('sub-social-presence');
        this.activeRoomSubscriptions.forEach(roomId => {
          this.socialUnsubscribe(`sub-social-room-${roomId}`);
          this.socialUnsubscribe(`sub-social-typing-${roomId}`);
        });
      }
      this.socialSocket = null;
      socialSocket.close();
    }
    this.stopPresenceHeartbeat();
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

  public sendTyping(roomId: string, isTyping: boolean): void {
    if (!this.socialSocket || !this.isSocialConnected) return;
    const payload = {
      conversationId: roomId,
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
  }

  private sendUnsubscribeFrame(): void {
    if (!this.socket || !this.isConnected) return;

    try {
      this.unsubscribe(this.notificationSubscriptionId);
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
          this.reconnectAttempts = 0;
          this.sendSubscribeFrame();
          this.startNotificationHeartbeat(frame.headers['heart-beat']);
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
    this.authVerified = false;
    this.isConnected = false;
    this.socket = null;
    this.stopNotificationHeartbeat();

    this.scheduleReconnect();
  }

  private startNotificationHeartbeat(serverHeartbeat?: string): void {
    this.stopNotificationHeartbeat();
    const serverOutgoingMs = Number(serverHeartbeat?.split(',')[0] ?? 0);
    // A CONNECTED heart-beat of 0,x means the server will not send heartbeats.
    // Do not treat that valid STOMP negotiation as a dead connection every 25s.
    if (!Number.isFinite(serverOutgoingMs) || serverOutgoingMs <= 0) return;

    this.lastNotificationActivityAt = Date.now();
    const timeoutMs = Math.max(
      StompWebSocketService.HEARTBEAT_TIMEOUT_MS,
      serverOutgoingMs * 2.5
    );
    this.notificationHeartbeatInterval = setInterval(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
      if (Date.now() - this.lastNotificationActivityAt > timeoutMs) {
        console.warn('WebSocket notification heartbeat timed out; forcing reconnect.');
        this.socket.close();
        return;
      }
    }, Math.max(StompWebSocketService.HEARTBEAT_INTERVAL_MS, serverOutgoingMs));
  }

  private stopNotificationHeartbeat(): void {
    if (this.notificationHeartbeatInterval) {
      clearInterval(this.notificationHeartbeatInterval);
      this.notificationHeartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.shouldReconnect && !this.reconnectTimeout) {
      const delay = this.nextReconnectDelay(this.reconnectAttempts++);
      console.log(`Attempting reconnection in ${delay}ms...`);
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null;
        this.connect();
      }, delay);
    }
  }

  private nextReconnectDelay(attempts: number): number {
    const exponential = Math.min(
      StompWebSocketService.RECONNECT_MAX_MS,
      StompWebSocketService.RECONNECT_BASE_MS * Math.pow(2, attempts)
    );
    return Math.round(exponential * (0.5 + Math.random() * 0.5));
  }

  private connectSocialSocket(): void {
    if (this.socialSocket || this.isSocialConnected) return;

    let wsUrl = this.apiBase.replace(/^http/, 'ws').replace(/\/+$/, '');
    wsUrl += '/social-service/ws';

    console.info('[Social STOMP] Connecting to:', wsUrl);

    try {
      const socket = new WebSocket(wsUrl);
      this.socialSocket = socket;

      socket.onopen = () => {
        if (this.socialSocket !== socket) return;
        console.info('[Social STOMP] WebSocket opened. Sending CONNECT frame.');
        this.sendSocialFrame(new StompFrame('CONNECT', {
          'accept-version': '1.1,1.2',
          'heart-beat': '10000,10000'
        }, ''));
      };
      socket.onmessage = (event: MessageEvent) => {
        if (this.socialSocket !== socket) return;
        this.lastSocialActivityAt = Date.now();
        if (event.data !== '\n' && event.data !== '\r\n') {
          this.handleSocialStompFrame(event.data);
        }
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

  private handleSocialStompFrame(data: string): void {
    const frame = StompFrame.parse(data);
    if (!frame) return;

    if (frame.command === 'CONNECTED') {
      console.info('[Social STOMP] Connected. Subscribing to presence and chat rooms.');
      this.isSocialConnected = true;
      this.socialReconnectAttempts = 0;
      this.socialSubscribe('sub-social-presence', '/topic/presence');
      this.publishPresence(true);
      this.stopPresenceHeartbeat();
      this.presenceHeartbeatInterval = setInterval(() => this.publishPresence(true), 15_000);
      this.startSocialStompHeartbeat(frame.headers['heart-beat']);
      this.activeRoomSubscriptions.forEach(roomId => {
        this.socialSubscribe(`sub-social-room-${roomId}`, `/topic/conversations/${roomId}`);
        this.socialSubscribe(`sub-social-typing-${roomId}`, `/topic/conversations/${roomId}/typing`);
      });
      return;
    }
    if (frame.command !== 'MESSAGE') return;

    const destination = frame.headers['destination'] || '';
    if (destination === '/topic/presence') {
      try {
        const payload = JSON.parse(frame.body);
        this.presenceEventSubject.next({
          userId: payload.userId,
          online: Boolean(payload.online),
          lastSeenAt: payload.lastSeenAt
        });
      } catch (error) {
        console.error('Không thể chuyển đổi trạng thái hoạt động realtime.', error);
      }
      return;
    }

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
          deliveryState: 'SENT',
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
    this.socialSocket.send(frame.toString());
  }

  private socialSubscribe(id: string, destination: string): void {
    this.sendSocialFrame(new StompFrame('SUBSCRIBE', { id, destination }, ''));
  }

  private socialUnsubscribe(id: string): void {
    this.sendSocialFrame(new StompFrame('UNSUBSCRIBE', { id }, ''));
  }

  private handleSocialDisconnect(): void {
    this.authVerified = false;
    this.stopPresenceHeartbeat();
    this.stopSocialStompHeartbeat();
    this.isSocialConnected = false;
    this.socialSocket = null;
    if (this.shouldReconnect && !this.socialReconnectTimeout) {
      const delay = this.nextReconnectDelay(this.socialReconnectAttempts++);
      this.socialReconnectTimeout = setTimeout(() => {
        this.socialReconnectTimeout = null;
        this.connect();
      }, delay);
    }
  }

  private publishPresence(online: boolean): void {
    const userId = this.currentUserProvider.getCurrentUserId();
    if (!userId || !this.isSocialConnected) return;
    const destination = online
      ? '/app/social/presence.heartbeat'
      : '/app/social/presence.offline';
    this.sendSocialFrame(new StompFrame('SEND', { destination }, JSON.stringify({ userId })));
  }

  private stopPresenceHeartbeat(): void {
    if (!this.presenceHeartbeatInterval) return;
    clearInterval(this.presenceHeartbeatInterval);
    this.presenceHeartbeatInterval = null;
  }

  private startSocialStompHeartbeat(serverHeartbeat?: string): void {
    this.stopSocialStompHeartbeat();
    const serverOutgoingMs = Number(serverHeartbeat?.split(',')[0] ?? 0);
    if (!Number.isFinite(serverOutgoingMs) || serverOutgoingMs <= 0) return;

    this.lastSocialActivityAt = Date.now();
    const timeoutMs = Math.max(
      StompWebSocketService.HEARTBEAT_TIMEOUT_MS,
      serverOutgoingMs * 2.5
    );
    this.socialStompHeartbeatInterval = setInterval(() => {
      if (!this.socialSocket || this.socialSocket.readyState !== WebSocket.OPEN) return;
      if (Date.now() - this.lastSocialActivityAt > timeoutMs) {
        console.warn('Social WebSocket heartbeat timed out; forcing reconnect.');
        this.socialSocket.close();
      }
    }, Math.max(StompWebSocketService.HEARTBEAT_INTERVAL_MS, serverOutgoingMs));
  }

  private stopSocialStompHeartbeat(): void {
    if (this.socialStompHeartbeatInterval) {
      clearInterval(this.socialStompHeartbeatInterval);
      this.socialStompHeartbeatInterval = null;
    }
  }
}
