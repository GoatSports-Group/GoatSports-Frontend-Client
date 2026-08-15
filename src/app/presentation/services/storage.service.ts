import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { UploadAvatarUseCase } from '@application/usecase/storage/upload-avatar.usecase';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private uploadAvatarUseCase = inject(UploadAvatarUseCase);

  uploadAvatar(file: File): Observable<string> {
    return this.uploadAvatarUseCase.execute(file);
  }
}
