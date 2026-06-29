import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { NotificationRepository, NOTIFICATION_REPOSITORY_TOKEN } from '@application/ports/persistence/notification.repository';
import { Notification } from '@domain/entity/notification';

@Injectable({
  providedIn: 'root'
})
export class GetNotificationsUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_TOKEN) private repository: NotificationRepository
  ) { }

  execute(): Observable<Notification[]> {
    return this.repository.getNotifications();
  }
}
