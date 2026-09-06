import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '@application/dto/user/user.dto';
import { UserRepository, USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';

@Injectable({
  providedIn: 'root'
})
export class GetUserByIdUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN) private repository: UserRepository
  ) { }

  execute(userId: string): Observable<User> {
    return this.repository.getUserById(userId);
  }
}
