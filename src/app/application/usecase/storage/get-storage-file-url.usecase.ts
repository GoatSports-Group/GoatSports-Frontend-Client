import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  STORAGE_REPOSITORY_TOKEN,
  StorageRepository
} from '@application/ports/persistence/storage.repository';

@Injectable({ providedIn: 'root' })
export class GetStorageFileUrlUseCase {
  constructor(
    @Inject(STORAGE_REPOSITORY_TOKEN) private readonly repository: StorageRepository
  ) {}

  execute(key: string): Observable<string> {
    return this.repository.getFileUrl(key);
  }
}
