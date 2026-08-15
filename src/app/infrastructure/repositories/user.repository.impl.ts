import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UserRepository } from '@application/ports/persistence/user.repository';
import { User, UpdatePasswordRequest, CreatePasswordRequest } from '@application/dto/user/user.dto';
import { UserApi } from '@infrastructure/api/user.api';

@Injectable({
  providedIn: 'root'
})
export class UserRepositoryImpl implements UserRepository {
  private userApi = inject(UserApi);

  getUserById(userId: string): Observable<User> {
    return this.userApi.getUserById(userId).pipe(
      map(response => response.data)
    );
  }

  updateUser(userId: string, data: Partial<User>): Observable<User> {
    return this.userApi.updateUser(userId, data).pipe(
      map(response => response.data)
    );
  }

  updateAvatar(userId: string, tempKey: string): Observable<void> {
    return this.userApi.updateAvatar(userId, tempKey).pipe(
      map(() => void 0)
    );
  }

  updatePassword(payload: UpdatePasswordRequest): Observable<void> {
    return this.userApi.updatePassword(payload).pipe(
      map(() => void 0)
    );
  }

  createPassword(payload: CreatePasswordRequest): Observable<void> {
    return this.userApi.createPassword(payload).pipe(
      map(() => void 0)
    );
  }
}
