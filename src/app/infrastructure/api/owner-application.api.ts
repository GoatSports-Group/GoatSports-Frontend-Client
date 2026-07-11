import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpBackend } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OwnerApplication } from '@domain/entities/owner-application';
import { BaseResponse } from '@application/dto/base/base-response';

export interface OwnerApplicationListResponse {
  meta: {
    page: number;
    pageSize: number;
    pages: number;
    total: number;
  };
  result: OwnerApplication[];
}

export interface PresignedUrlRequest {
  fileName: string;
  contentType: string;
  folder: string;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  objectKey: string;
}

@Injectable({
  providedIn: 'root'
})
export class OwnerApplicationApi {
  private http = inject(HttpClient);
  private httpBackend = inject(HttpBackend);
  private bypassHttp = new HttpClient(this.httpBackend);
  private apiBase = import.meta.env.NG_APP_API_URL;

  submit(request: any): Observable<BaseResponse<OwnerApplication>> {
    return this.http.post<BaseResponse<OwnerApplication>>(
      `${this.apiBase}/venue-service/api/v1/owner-applications`,
      request
    );
  }

  getPresignedUrls(requests: PresignedUrlRequest[]): Observable<BaseResponse<PresignedUrlResponse[]>> {
    return this.http.post<BaseResponse<PresignedUrlResponse[]>>(
      `${this.apiBase}/storage-service/api/v1/files/presigned-url`,
      requests
    );
  }

  uploadToPresignedUrl(uploadUrl: string, file: File): Observable<any> {
    return this.bypassHttp.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type
      }
    });
  }

  createDocuments(ownerApplicationId: string, documentKeys: string[]): Observable<void> {
    return this.http.post<void>(
      `${this.apiBase}/venue-service/api/v1/documents`,
      {
        ownerApplicationId,
        documentKeys
      }
    );
  }

  getMyApplications(): Observable<BaseResponse<OwnerApplicationListResponse>> {
    return this.http.get<BaseResponse<OwnerApplicationListResponse>>(
      `${this.apiBase}/venue-service/api/v1/owner-applications/me`
    );
  }
}
