import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { User } from '@domain/entities/user';
import { environment } from '@environments/environment';
import { PublicKeyResponse } from '@application/dto/auth/auth.dto';

@Injectable({
  providedIn: 'root'
})
export class AuthApi {
  private http = inject(HttpClient);
  private apiBase = environment.apiUrl;

  logout(): Observable<BaseResponse<void>> {
    return this.http.post<BaseResponse<void>>(`${this.apiBase}/auth-service/api/v1/auth/logout`, {}, { withCredentials: true });
  }

  refresh(): Observable<BaseResponse<User>> {
    return this.http.get<BaseResponse<User>>(`${this.apiBase}/auth-service/api/v1/auth/refresh`, { withCredentials: true });
  }

  getCurrentUser(): Observable<BaseResponse<User>> {
    return this.http.get<BaseResponse<User>>(`${this.apiBase}/auth-service/api/v1/auth/me`);
  }

  getPublicKey(): Observable<BaseResponse<PublicKeyResponse>> {
    return this.http.get<BaseResponse<PublicKeyResponse>>(`${this.apiBase}/auth-service/api/v1/auth/public-key`);
  }
}
