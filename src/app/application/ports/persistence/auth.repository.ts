import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '@domain/entities/user';

export interface AuthRepository {
  logout(): Observable<void>;
  refresh(): Observable<User>;
  getCurrentUser(): Observable<User>;
  getPublicKey(): Observable<string>;
}

export const AUTH_REPOSITORY_TOKEN = new InjectionToken<AuthRepository>('AuthRepository');
