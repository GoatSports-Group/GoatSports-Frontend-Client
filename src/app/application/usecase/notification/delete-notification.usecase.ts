import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { NotificationRepository, NOTIFICATION_REPOSITORY_TOKEN } from '@application/ports/persistence/notification.repository';

@Injectable({
  providedIn: 'root'
})
export class DeleteNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_TOKEN) private repository: NotificationRepository
  ) { }

  execute(id: string): Observable<void> {
    return this.repository.deleteNotification(id);
  }
}
