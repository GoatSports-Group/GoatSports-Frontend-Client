import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UserRepository, USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';
import { User } from '@domain/entities/user';

@Injectable({
  providedIn: 'root'
})
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN) private repository: UserRepository
  ) { }

  execute(userId: string, data: Partial<User>): Observable<User> {
    return this.repository.updateUser(userId, data);
  }
}
