import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UserRepository, USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';
import { CreatePasswordRequest } from '@application/dto/user/user.dto';

@Injectable({
  providedIn: 'root'
})
export class CreatePasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN) private repository: UserRepository
  ) { }

  execute(payload: CreatePasswordRequest): Observable<void> {
    return this.repository.createPassword(payload);
  }
}
