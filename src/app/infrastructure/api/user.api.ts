import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { User, UpdateUserRequest, UpdatePasswordRequest, CreatePasswordRequest, PlayerSummary } from '@application/dto/user/user.dto';
import {
  CURRENT_USER_PROVIDER_TOKEN,
  CurrentUserProvider
} from '@application/ports/current-user.provider';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserApi {
  private http = inject(HttpClient);
  private currentUser = inject<CurrentUserProvider>(CURRENT_USER_PROVIDER_TOKEN);
  private apiBase = environment.apiUrl;

  getUserById(userId: string): Observable<BaseResponse<User>> {
    return this.http.get<BaseResponse<User>>(`${this.apiBase}/auth-service/api/v1/users/${userId}`);
  }

  updateUser(userId: string, payload: UpdateUserRequest): Observable<BaseResponse<User>> {
    return this.http.put<BaseResponse<User>>(`${this.apiBase}/auth-service/api/v1/users/${userId}`, payload);
  }

  updateAvatar(userId: string, tempKey: string): Observable<BaseResponse<void>> {
    const params = new HttpParams().set('tempKey', tempKey);
    return this.http.put<BaseResponse<void>>(`${this.apiBase}/auth-service/api/v1/users/${userId}/avatar`, null, { params });
  }

  updatePassword(payload: UpdatePasswordRequest): Observable<BaseResponse<void>> {
    return this.http.put<BaseResponse<void>>(`${this.apiBase}/auth-service/api/v1/users/password`, payload);
  }

  createPassword(payload: CreatePasswordRequest): Observable<BaseResponse<void>> {
    return this.http.post<BaseResponse<void>>(`${this.apiBase}/auth-service/api/v1/users/password`, payload);
  }

  searchPlayers(query: string): Observable<BaseResponse<PlayerSummary[]>> {
    const currentUserId = this.currentUser.getCurrentUserId();
    if (!currentUserId) {
      throw new Error('Không tìm thấy phiên đăng nhập hiện tại.');
    }

    const params = new HttpParams()
      .set('query', query.trim())
      .set('excludeUserId', currentUserId)
      .set('limit', '12');
    return this.http.get<BaseResponse<PlayerSummary[]>>(
      `${this.apiBase}/auth-service/api/v1/users/search`,
      { params }
    );
  }
}
