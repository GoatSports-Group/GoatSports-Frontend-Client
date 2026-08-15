import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '@domain/entities/user';

export interface UserRepository {
  getUserById(userId: string): Observable<User>;
  updateUser(userId: string, data: Partial<User>): Observable<User>;
  updateAvatar(userId: string, tempKey: string): Observable<void>;
}

export const USER_REPOSITORY_TOKEN = new InjectionToken<UserRepository>('UserRepository');
