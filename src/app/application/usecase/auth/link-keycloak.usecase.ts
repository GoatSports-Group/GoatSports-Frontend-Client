import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { AuthRepository, AUTH_REPOSITORY_TOKEN } from '@application/ports/persistence/auth.repository';

@Injectable({
  providedIn: 'root'
})
export class LinkKeycloakUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY_TOKEN) private authRepository: AuthRepository
  ) { }

  execute(payload: { code: string; redirectUri: string }): Observable<BaseResponse<void>> {
    return this.authRepository.linkKeycloak(payload);
  }
}
