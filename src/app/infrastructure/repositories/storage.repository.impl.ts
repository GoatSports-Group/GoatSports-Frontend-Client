import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { StorageRepository } from '@application/ports/persistence/storage.repository';
import { PresignedUrlResponse } from '@application/dto/storage/storage.dto';
import { StorageApi } from '@infrastructure/api/storage.api';

@Injectable({
  providedIn: 'root'
})
export class StorageRepositoryImpl implements StorageRepository {
  private storageApi = inject(StorageApi);

  getPresignedUrl(fileName: string, contentType: string, folder: string): Observable<PresignedUrlResponse[]> {
    return this.storageApi.getPresignedUrl(fileName, contentType, folder).pipe(
      map((response: any) => (Array.isArray(response) ? response : (response?.data || [])))
    );
  }

  uploadToPresignedUrl(uploadUrl: string, file: File): Observable<any> {
    return this.storageApi.uploadToPresignedUrl(uploadUrl, file);
  }

  confirmUpload(tempKey: string): Observable<string[]> {
    return this.storageApi.confirmUpload(tempKey).pipe(
      map((response: any) => (Array.isArray(response) ? response : (response?.data || [])))
    );
  }

  uploadAvatar(file: File): Observable<string> {
    return this.getPresignedUrl(file.name, file.type, 'avatars').pipe(
      switchMap((presignedList) => {
        const presigned = presignedList?.[0];
        if (!presigned?.uploadUrl || !presigned?.objectKey) {
          throw new Error('Không lấy được URL tải lên từ storage service');
        }
        return this.uploadToPresignedUrl(presigned.uploadUrl, file).pipe(
          map(() => presigned.objectKey)
        );
      })
    );
  }
}
