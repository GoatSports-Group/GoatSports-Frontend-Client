import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Notification } from '@domain/entity/notification';

export interface WebSocketService {
  notifications$: Observable<Notification>;
  connect(): void;
  disconnect(): void;
}

export const WEBSOCKET_SERVICE_TOKEN = new InjectionToken<WebSocketService>('WebSocketService');
