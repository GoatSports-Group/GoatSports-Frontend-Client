import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { StorageRepository, STORAGE_REPOSITORY_TOKEN } from '@application/ports/persistence/storage.repository';

@Injectable({
  providedIn: 'root'
})
export class UploadAvatarUseCase {
  constructor(
    @Inject(STORAGE_REPOSITORY_TOKEN) private repository: StorageRepository
  ) { }

  execute(file: File): Observable<string> {
    return this.repository.uploadAvatar(file);
  }
}
