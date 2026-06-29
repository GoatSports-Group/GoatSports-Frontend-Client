import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OwnerApplication } from '@domain/entity/owner-application';
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

@Injectable({
  providedIn: 'root'
})
export class OwnerApplicationApi {
  private http = inject(HttpClient);
  private apiBase = import.meta.env.NG_APP_API_URL;

  submit(formData: FormData): Observable<BaseResponse<OwnerApplication>> {
    return this.http.post<BaseResponse<OwnerApplication>>(
      `${this.apiBase}/venue-service/api/v1/owner-applications`,
      formData
    );
  }

  getMyApplications(): Observable<BaseResponse<OwnerApplicationListResponse>> {
    return this.http.get<BaseResponse<OwnerApplicationListResponse>>(
      `${this.apiBase}/venue-service/api/v1/owner-applications/me`
    );
  }
}
