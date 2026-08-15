import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UserRepository, USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';

@Injectable({
  providedIn: 'root'
})
export class UpdateUserAvatarUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN) private repository: UserRepository
  ) { }

  execute(userId: string, tempKey: string): Observable<void> {
    return this.repository.updateAvatar(userId, tempKey);
  }
}
