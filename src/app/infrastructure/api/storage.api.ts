import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpBackend } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { PresignedUrlResponse } from '@application/dto/storage/storage.dto';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StorageApi {
  private http = inject(HttpClient);
  private httpBackend = inject(HttpBackend);
  private bypassHttp = new HttpClient(this.httpBackend);
  private apiBase = environment.apiUrl;

  getPresignedUrl(fileName: string, contentType: string, folder: string): Observable<BaseResponse<PresignedUrlResponse[]>> {
    const payload = [{ fileName, contentType, folder }];
    return this.http.post<BaseResponse<PresignedUrlResponse[]>>(
      `${this.apiBase}/storage-service/api/v1/files/presigned-url`,
      payload
    );
  }

  uploadToPresignedUrl(uploadUrl: string, file: File): Observable<any> {
    return this.bypassHttp.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type
      }
    });
  }

  confirmUpload(tempKey: string): Observable<BaseResponse<string[]>> {
    const payload = [{ tempKey }];
    return this.http.post<BaseResponse<string[]>>(
      `${this.apiBase}/storage-service/api/v1/files/confirm-upload`,
      payload
    );
  }
}
