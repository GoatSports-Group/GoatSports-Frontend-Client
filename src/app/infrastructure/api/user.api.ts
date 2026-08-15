import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { User, UpdatePasswordRequest, CreatePasswordRequest } from '@application/dto/user/user.dto';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserApi {
  private http = inject(HttpClient);
  private apiBase = environment.apiUrl;

  getUserById(userId: string): Observable<BaseResponse<User>> {
    return this.http.get<BaseResponse<User>>(`${this.apiBase}/auth-service/api/v1/users/${userId}`);
  }

  updateUser(userId: string, payload: Partial<User>): Observable<BaseResponse<User>> {
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
}
