import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { User } from '@domain/entity/user';

export interface AuthRepository {
  linkKeycloak(payload: { code: string; redirectUri: string }): Observable<BaseResponse<void>>;
  logout(): Observable<BaseResponse<void>>;
  refresh(): Observable<BaseResponse<User>>;
  getCurrentUser(): Observable<BaseResponse<User>>;
}

export const AUTH_REPOSITORY_TOKEN = new InjectionToken<AuthRepository>('AuthRepository');
