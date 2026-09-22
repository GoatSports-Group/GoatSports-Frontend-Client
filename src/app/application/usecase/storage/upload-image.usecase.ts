import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { STORAGE_REPOSITORY_TOKEN, StorageRepository } from '@application/ports/persistence/storage.repository';

@Injectable({ providedIn: 'root' })
export class UploadImageUseCase {
  constructor(@Inject(STORAGE_REPOSITORY_TOKEN) private readonly repository: StorageRepository) {}

  execute(file: File, folder: string): Observable<string> {
    return this.repository.uploadImage(file, folder);
  }

  executeMany(files: File[], folder: string): Observable<string[]> {
    return this.repository.uploadImages(files, folder);
  }
}
