import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { PresignedUrlResponse } from '@application/dto/storage/storage.dto';

export interface StorageRepository {
  getPresignedUrl(
    fileName: string,
    contentType: string,
    folder: string,
    contentLength: number
  ): Observable<PresignedUrlResponse[]>;
  uploadToPresignedUrl(uploadUrl: string, file: File): Observable<any>;
  getFileUrl(key: string): Observable<string>;
  uploadAvatar(file: File): Observable<string>;
  uploadImage(file: File, folder: string): Observable<string>;
}

export const STORAGE_REPOSITORY_TOKEN = new InjectionToken<StorageRepository>('StorageRepository');
