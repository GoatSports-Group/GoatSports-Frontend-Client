import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { UploadAvatarUseCase } from '@application/usecase/storage/upload-avatar.usecase';
import { UploadImageUseCase } from '@application/usecase/storage/upload-image.usecase';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private uploadAvatarUseCase = inject(UploadAvatarUseCase);
  private uploadImageUseCase = inject(UploadImageUseCase);

  uploadAvatar(file: File): Observable<string> {
    return this.uploadAvatarUseCase.execute(file);
  }

  uploadImage(file: File, folder: string): Observable<string> {
    return this.uploadImageUseCase.execute(file, folder);
  }

  uploadImages(files: File[], folder: string): Observable<string[]> {
    return this.uploadImageUseCase.executeMany(files, folder);
  }
}
