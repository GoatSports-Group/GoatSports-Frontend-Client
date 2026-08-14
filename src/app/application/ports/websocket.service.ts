import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Notification } from '@domain/entities/notification';
import { OwnerApplicationProgressChangedEvent } from '@application/dto/workflow/owner-application-progress.dto';

export interface WebSocketService {
  notifications$: Observable<Notification>;
  ownerApplicationProgress$: Observable<OwnerApplicationProgressChangedEvent>;
  connect(): void;
  disconnect(): void;
}

export const WEBSOCKET_SERVICE_TOKEN = new InjectionToken<WebSocketService>('WebSocketService');
