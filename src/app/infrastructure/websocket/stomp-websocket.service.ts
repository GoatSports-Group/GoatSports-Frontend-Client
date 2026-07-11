import { Injectable, inject } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { Notification } from '@domain/entities/notification';
import { WebSocketService } from '@application/ports/websocket.service';
import { SessionStateService } from '@presentation/services/session-state.service';

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
  private isConnected = false;
  private reconnectTimeout: any = null;
  private apiBase = import.meta.env.NG_APP_API_URL;
  private subscriptionId = 'sub-user-notifications';
  private sessionStateService = inject(SessionStateService);

  private notificationSubject = new Subject<Notification>();
  public notifications$: Observable<Notification> = this.notificationSubject.asObservable();

  constructor() { }

  public connect(): void {
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
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('WebSocket connection opened. Sending STOMP CONNECT...');
        this.sendConnectFrame();
      };

      this.socket.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data);
      };

      this.socket.onclose = (event: CloseEvent) => {
        console.log('WebSocket connection closed:', event.reason);
        this.handleDisconnect();
      };

      this.socket.onerror = (error: Event) => {
        console.error('WebSocket error occurred:', error);
      };
    } catch (err) {
      console.error('Error starting WebSocket connection:', err);
      this.handleDisconnect();
    }
  }

  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      if (this.isConnected) {
        this.sendUnsubscribeFrame();
      }
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
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

    const currentUser = this.sessionStateService.getCurrentUser();
    if (!currentUser) {
      console.warn('Cannot subscribe to STOMP notifications: No active user session.');
      return;
    }

    const destination = `/topic/user/notifications/${currentUser.userId}`;
    const subscribeFrame = new StompFrame('SUBSCRIBE', {
      id: this.subscriptionId,
      destination: destination
    }, '');

    this.socket.send(subscribeFrame.toString());
    console.log(`STOMP SUBSCRIBE sent for ${destination}`);
  }

  private sendUnsubscribeFrame(): void {
    if (!this.socket || !this.isConnected) return;

    const unsubscribeFrame = new StompFrame('UNSUBSCRIBE', {
      id: this.subscriptionId
    }, '');

    try {
      this.socket.send(unsubscribeFrame.toString());
      console.log('STOMP UNSUBSCRIBE sent');
    } catch (e) {
      console.error('Error sending unsubscribe frame:', e);
    }
  }

  private handleMessage(data: string): void {
    // Ignore heartbeats (empty lines/keep-alives)
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
          const currentUser = this.sessionStateService.getCurrentUser();
          const expectedDestination = `/topic/user/notifications/${currentUser?.userId}`;
          if (frame.headers['destination'] === expectedDestination) {
            console.log('STOMP MESSAGE received:', frame.body);
            try {
              const notification: Notification = JSON.parse(frame.body);
              this.notificationSubject.next(notification);
            } catch (jsonErr) {
              console.error('Failed to parse STOMP message body as JSON:', jsonErr);
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

  private handleDisconnect(): void {
    this.isConnected = false;
    this.socket = null;

    // Retry connection after 5 seconds
    if (!this.reconnectTimeout) {
      console.log('Attempting reconnection in 5 seconds...');
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null;
        this.connect();
      }, 5000);
    }
  }
}
