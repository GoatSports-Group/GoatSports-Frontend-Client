import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthRepository } from '../../domain/repositories/auth.repository';
import { AUTH_REPOSITORY_TOKEN } from '../../domain/repositories/tokens';
import { BaseResponse } from '../../domain/entities/base';

@Injectable({
  providedIn: 'root'
})
export class LogoutUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY_TOKEN) private authRepository: AuthRepository
  ) {}

  execute(): Observable<BaseResponse<void>> {
    return this.authRepository.logout();
  }
}
