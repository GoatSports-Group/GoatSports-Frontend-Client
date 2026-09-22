import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { StorageRepository } from '@application/ports/persistence/storage.repository';
import { PresignedUrlRequest, PresignedUrlResponse } from '@application/dto/storage/storage.dto';
import { StorageApi } from '@infrastructure/api/storage.api';

@Injectable({
  providedIn: 'root'
})
export class StorageRepositoryImpl implements StorageRepository {
  private storageApi = inject(StorageApi);

  getPresignedUrls(requests: PresignedUrlRequest[]): Observable<PresignedUrlResponse[]> {
    if (!requests.length) return of([]);
    return this.storageApi.getPresignedUrls(requests).pipe(
      map((response: any) => (Array.isArray(response) ? response : (response?.data || []))),
      map((list: PresignedUrlResponse[]) => {
        // Storage service trả về mảng rỗng khi lô vượt 10 tệp, nên phải đối chiếu số lượng.
        if (list.length !== requests.length || list.some(item => !item?.uploadUrl || !item?.objectKey)) {
          throw new Error('Không lấy được URL tải lên từ storage service');
        }
        return list;
      })
    );
  }

  uploadToPresignedUrl(uploadUrl: string, file: File): Observable<any> {
    return this.storageApi.uploadToPresignedUrl(uploadUrl, file);
  }

  getFileUrl(key: string): Observable<string> {
    return this.storageApi.getFileUrl(key);
  }

  uploadAvatar(file: File): Observable<string> {
    return this.uploadImage(file, 'avatars');
  }

  uploadImage(file: File, folder: string): Observable<string> {
    return this.uploadImages([file], folder).pipe(map(keys => keys[0]));
  }

  uploadImages(files: File[], folder: string): Observable<string[]> {
    if (!files.length) return of([]);
    return this.getPresignedUrls(files.map(file => ({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      folder,
      contentLength: file.size
    }))).pipe(
      switchMap(presignedList => forkJoin(
        presignedList.map((presigned, index) =>
          this.uploadToPresignedUrl(presigned.uploadUrl, files[index]).pipe(map(() => presigned.objectKey))
        )
      ))
    );
  }
}
