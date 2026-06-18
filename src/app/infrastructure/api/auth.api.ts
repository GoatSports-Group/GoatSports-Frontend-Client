import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseResponse } from '../../domain/entities/base';
import { User } from '../../domain/entities/user';

@Injectable({
  providedIn: 'root'
})
export class AuthApi {
  private http = inject(HttpClient);
  private apiBase = import.meta.env.NG_APP_API_URL;

  linkKeycloak(payload: { code: string; redirectUri: string }): Observable<BaseResponse<void>> {
    return this.http.post<BaseResponse<void>>(`${this.apiBase}/auth-service/api/v1/auth/link/keycloak`, payload, { withCredentials: true });
  }

  logout(): Observable<BaseResponse<void>> {
    return this.http.post<BaseResponse<void>>(`${this.apiBase}/auth-service/api/v1/auth/logout`, {}, { withCredentials: true });
  }

  refresh(): Observable<BaseResponse<User>> {
    return this.http.get<BaseResponse<User>>(`${this.apiBase}/auth-service/api/v1/auth/refresh`, { withCredentials: true });
  }

  getCurrentUser(): Observable<BaseResponse<User>> {
    return this.http.get<BaseResponse<User>>(`${this.apiBase}/auth-service/api/v1/auth/me`);
  }
}
