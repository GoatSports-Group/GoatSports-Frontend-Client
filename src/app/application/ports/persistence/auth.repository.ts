import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '@domain/entity/user';

export interface AuthRepository {
  linkKeycloak(payload: { code: string; redirectUri: string }): Observable<void>;
  logout(): Observable<void>;
  refresh(): Observable<User>;
  getCurrentUser(): Observable<User>;
}

export const AUTH_REPOSITORY_TOKEN = new InjectionToken<AuthRepository>('AuthRepository');
