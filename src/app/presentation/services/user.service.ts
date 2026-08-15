import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '@application/dto/user/user.dto';
import { UpdateUserUseCase } from '@application/usecase/user/update-user.usecase';
import { UpdateUserAvatarUseCase } from '@application/usecase/user/update-user-avatar.usecase';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private updateUserUseCase = inject(UpdateUserUseCase);
  private updateUserAvatarUseCase = inject(UpdateUserAvatarUseCase);

  updateUser(userId: string, data: Partial<User>): Observable<User> {
    return this.updateUserUseCase.execute(userId, data);
  }

  updateAvatar(userId: string, tempKey: string): Observable<void> {
    return this.updateUserAvatarUseCase.execute(userId, tempKey);
  }
}
