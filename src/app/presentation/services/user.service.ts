import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { User, UpdatePasswordRequest, CreatePasswordRequest } from '@application/dto/user/user.dto';
import { UpdateUserUseCase } from '@application/usecase/user/update-user.usecase';
import { UpdateUserAvatarUseCase } from '@application/usecase/user/update-user-avatar.usecase';
import { UpdatePasswordUseCase } from '@application/usecase/user/update-password.usecase';
import { CreatePasswordUseCase } from '@application/usecase/user/create-password.usecase';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private updateUserUseCase = inject(UpdateUserUseCase);
  private updateUserAvatarUseCase = inject(UpdateUserAvatarUseCase);
  private updatePasswordUseCase = inject(UpdatePasswordUseCase);
  private createPasswordUseCase = inject(CreatePasswordUseCase);

  updateUser(userId: string, data: Partial<User>): Observable<User> {
    return this.updateUserUseCase.execute(userId, data);
  }

  updateAvatar(userId: string, tempKey: string): Observable<void> {
    return this.updateUserAvatarUseCase.execute(userId, tempKey);
  }

  updatePassword(payload: UpdatePasswordRequest): Observable<void> {
    return this.updatePasswordUseCase.execute(payload);
  }

  createPassword(payload: CreatePasswordRequest): Observable<void> {
    return this.createPasswordUseCase.execute(payload);
  }
}
