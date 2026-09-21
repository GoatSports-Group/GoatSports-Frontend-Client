import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthRepository } from '@application/ports/persistence/auth.repository';
import { AuthApi } from '@infrastructure/api/auth.api';
import { User } from '@domain/entities/user';
import { BaseResponse } from '@application/dto/base/base-response';

@Injectable({
  providedIn: 'root'
})
export class AuthRepositoryImpl implements AuthRepository {
  private authApi = inject(AuthApi);

  logout(): Observable<void> {
    return this.authApi.logout().pipe(
      map(response => response.data)
    );
  }

  refresh(): Observable<User> {
    return this.authApi.refresh().pipe(
      map(response => this.unwrapResponse(response))
    );
  }

  getCurrentUser(): Observable<User> {
    return this.authApi.getCurrentUser().pipe(
      map(response => this.unwrapResponse(response))
    );
  }

  getPublicKey(): Observable<string> {
    return this.authApi.getPublicKey().pipe(
      map(response => response.data.publicKey)
    );
  }

  private unwrapResponse<T>(response: BaseResponse<T> | T): T {
    if (response && typeof response === 'object' && 'data' in response) {
      const data = (response as BaseResponse<T>).data;
      if (data != null) return data;
    } else if (response != null) {
      return response as T;
    }

    throw new Error('Phản hồi xác thực không chứa dữ liệu người dùng.');
  }
}
