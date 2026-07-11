import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { NotificationRepository, NOTIFICATION_REPOSITORY_TOKEN } from '@application/ports/persistence/notification.repository';
import { Notification } from '@domain/entities/notification';

@Injectable({
  providedIn: 'root'
})
export class MarkNotificationReadUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_TOKEN) private repository: NotificationRepository
  ) { }

  execute(id: string): Observable<Notification> {
    return this.repository.markAsRead(id);
  }
}
