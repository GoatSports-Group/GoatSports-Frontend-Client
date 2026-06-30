import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '@domain/entity/user';
import { AuthRepository, AUTH_REPOSITORY_TOKEN } from '@application/ports/persistence/auth.repository';

@Injectable({
  providedIn: 'root'
})
export class GetCurrentUserUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY_TOKEN) private authRepository: AuthRepository
  ) { }

  execute(): Observable<User> {
    return this.authRepository.getCurrentUser();
  }
}
