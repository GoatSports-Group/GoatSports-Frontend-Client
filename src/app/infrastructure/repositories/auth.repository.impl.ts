import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthRepository } from '@application/ports/persistence/auth.repository';
import { AuthApi } from '@infrastructure/api/auth.api';
import { User } from '@domain/entities/user';

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
      map(response => response.data)
    );
  }

  getCurrentUser(): Observable<User> {
    return this.authApi.getCurrentUser().pipe(
      map(response => response.data)
    );
  }

  getPublicKey(): Observable<string> {
    return this.authApi.getPublicKey().pipe(
      map(response => response.data.publicKey)
    );
  }
}
