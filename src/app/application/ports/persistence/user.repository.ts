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
  /** Mã các việc còn dang dở chặn xóa tài khoản (rỗng: xóa được). */
  getDeletionBlockers(): Observable<string[]>;
  sendDeletionCode(): Observable<void>;
  /** Trả về thời điểm tài khoản bị xóa thật (ISO). */
  requestDeletion(code: string): Observable<string>;
}

export const USER_REPOSITORY_TOKEN = new InjectionToken<UserRepository>('UserRepository');
