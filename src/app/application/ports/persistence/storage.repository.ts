import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { PresignedUrlRequest, PresignedUrlResponse } from '@application/dto/storage/storage.dto';

export interface StorageRepository {
  getPresignedUrls(requests: PresignedUrlRequest[]): Observable<PresignedUrlResponse[]>;
  uploadToPresignedUrl(uploadUrl: string, file: File): Observable<any>;
  getFileUrl(key: string): Observable<string>;
  uploadAvatar(file: File): Observable<string>;
  uploadImage(file: File, folder: string): Observable<string>;
  uploadImages(files: File[], folder: string): Observable<string[]>;
}

export const STORAGE_REPOSITORY_TOKEN = new InjectionToken<StorageRepository>('StorageRepository');
