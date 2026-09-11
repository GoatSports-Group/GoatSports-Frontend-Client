import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { OwnerApplication } from '@domain/entities/owner-application';
import { environment } from '@environments/environment';

export interface OwnerApplicationListResponse {
  meta: {
    page: number;
    pageSize: number;
    pages: number;
    total: number;
  };
  result: OwnerApplication[];
}

export type OwnerApplicationDocumentSlot =
  | 'IDENTITY_FRONT'
  | 'IDENTITY_BACK'
  | 'BUSINESS_LICENSE'
  | 'VENUE_PHOTO';

export interface PrepareOwnerApplicationUploadRequest {
  documents: Array<{
    slot: OwnerApplicationDocumentSlot;
    fileName: string;
    contentType: string;
  }>;
}

export interface PreparedOwnerApplicationUploadResponse {
  ownerApplicationId: string;
  documents: Array<{
    slot: OwnerApplicationDocumentSlot;
    uploadUrl: string;
    objectKey: string;
  }>;
}

export interface SubmitOwnerApplicationRequest {
  ownerApplicationId: string;
  fullName: string;
  phone: string;
  email: string;
  identityNumber: string;
  businessName: string;
  businessType: string;
  taxCode: string;
  address: string;
  province: string;
  district?: string;
  ward: string;
  city: string;
  latitude?: number;
  longitude?: number;
  documents: Array<{
    slot: OwnerApplicationDocumentSlot;
    objectKey: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class OwnerApplicationApi {
  private http = inject(HttpClient);
  private httpBackend = inject(HttpBackend);
  private bypassHttp = new HttpClient(this.httpBackend);
  private apiBase = environment.apiUrl;

  prepareUploads(
    request: PrepareOwnerApplicationUploadRequest,
    idempotencyKey: string
  ): Observable<BaseResponse<PreparedOwnerApplicationUploadResponse>> {
    return this.http.post<BaseResponse<PreparedOwnerApplicationUploadResponse>>(
      `${this.apiBase}/venue-service/api/v1/owner-applications/uploads`,
      request,
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
  }

  submitApplication(
    request: SubmitOwnerApplicationRequest
  ): Observable<BaseResponse<OwnerApplication>> {
    return this.http.post<BaseResponse<OwnerApplication>>(
      `${this.apiBase}/venue-service/api/v1/owner-applications`,
      request
    );
  }

  cleanupUploads(ownerApplicationId: string, objectKeys: string[]): Observable<void> {
    return this.http.post<void>(
      `${this.apiBase}/venue-service/api/v1/owner-applications/uploads/cleanup`,
      { ownerApplicationId, objectKeys }
    );
  }

  uploadToPresignedUrl(uploadUrl: string, file: File): Observable<unknown> {
    return this.bypassHttp.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream'
      }
    });
  }

  getMyApplications(): Observable<BaseResponse<OwnerApplicationListResponse>> {
    return this.http.get<BaseResponse<OwnerApplicationListResponse>>(
      `${this.apiBase}/venue-service/api/v1/owner-applications/me`
    );
  }
}
