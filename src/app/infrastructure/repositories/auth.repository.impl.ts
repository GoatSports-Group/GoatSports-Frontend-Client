import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthRepository } from '../../domain/repositories/auth.repository';
import { AuthApi } from '../api/auth.api';
import { BaseResponse } from '../../domain/entities/base';
import { User } from '../../domain/entities/user';

@Injectable({
  providedIn: 'root'
})
export class AuthRepositoryImpl implements AuthRepository {
  private authApi = inject(AuthApi);

  linkKeycloak(payload: { code: string; redirectUri: string }): Observable<BaseResponse<void>> {
    return this.authApi.linkKeycloak(payload);
  }

  logout(): Observable<BaseResponse<void>> {
    return this.authApi.logout();
  }

  refresh(): Observable<BaseResponse<User>> {
    return this.authApi.refresh();
  }

  getCurrentUser(): Observable<BaseResponse<User>> {
    return this.authApi.getCurrentUser();
  }
}
