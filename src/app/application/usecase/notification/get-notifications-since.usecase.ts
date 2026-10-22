import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { NotificationRepository, NOTIFICATION_REPOSITORY_TOKEN } from '@application/ports/persistence/notification.repository';
import { NotificationCatchUpPage } from '@application/dto/notification/notification.dto';

@Injectable({
  providedIn: 'root'
})
export class GetNotificationsSinceUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_TOKEN) private repository: NotificationRepository
  ) { }

  execute(after: string, afterId?: string): Observable<NotificationCatchUpPage> {
    return this.repository.getNotificationsSince(after, afterId);
  }
}
