import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UserRepository, USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';
import { UpdatePasswordRequest } from '@application/dto/user/user.dto';

@Injectable({
  providedIn: 'root'
})
export class UpdatePasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN) private repository: UserRepository
  ) { }

  execute(payload: UpdatePasswordRequest): Observable<void> {
    return this.repository.updatePassword(payload);
  }
}
