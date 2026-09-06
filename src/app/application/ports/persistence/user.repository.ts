import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { User, UpdateUserRequest, UpdatePasswordRequest, CreatePasswordRequest, PlayerSummary } from '@application/dto/user/user.dto';

export interface UserRepository {
  getUserById(userId: string): Observable<User>;
  updateUser(userId: string, data: UpdateUserRequest): Observable<User>;
  updateAvatar(userId: string, tempKey: string): Observable<void>;
  updatePassword(payload: UpdatePasswordRequest): Observable<void>;
  createPassword(payload: CreatePasswordRequest): Observable<void>;
  searchPlayers(query: string): Observable<PlayerSummary[]>;
}

export const USER_REPOSITORY_TOKEN = new InjectionToken<UserRepository>('UserRepository');
