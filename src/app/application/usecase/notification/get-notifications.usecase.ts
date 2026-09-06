import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { NotificationRepository, NOTIFICATION_REPOSITORY_TOKEN } from '@application/ports/persistence/notification.repository';
import { NotificationPage, NotificationQuery } from '@application/dto/notification/notification.dto';

@Injectable({
  providedIn: 'root'
})
export class GetNotificationsUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_TOKEN) private repository: NotificationRepository
  ) { }

  execute(query: NotificationQuery): Observable<NotificationPage> {
    return this.repository.getNotifications(query);
  }
}
