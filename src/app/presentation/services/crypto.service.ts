import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import JSEncrypt from 'jsencrypt';
import { environment } from '@environments/environment';
import { BaseResponse } from '@application/dto/base/base-response';

export interface PublicKeyData {
  publicKey: string;
}

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  private http = inject(HttpClient);
  private apiBase = environment.apiUrl;
  private cachedPublicKey: string | null = null;

  getPublicKey(): Observable<string> {
    if (this.cachedPublicKey) {
      return of(this.cachedPublicKey);
    }

    return this.http.get<BaseResponse<PublicKeyData>>(`${this.apiBase}/auth-service/api/v1/auth/public-key`).pipe(
      map(res => {
        const key = (res as any)?.data?.publicKey || (res as any)?.publicKey || '';
        return key;
      }),
      tap(key => {
        if (key) {
          this.cachedPublicKey = key;
        }
      })
    );
  }

  encrypt(plainText: string, publicKeyBase64: string): string {
    if (!plainText) return '';
    try {
      const encryptor = new JSEncrypt();
      const formattedKey = publicKeyBase64.includes('BEGIN PUBLIC KEY')
        ? publicKeyBase64
        : `-----BEGIN PUBLIC KEY-----\n${publicKeyBase64}\n-----END PUBLIC KEY-----`;
      encryptor.setPublicKey(formattedKey);
      const encrypted = encryptor.encrypt(plainText);
      return encrypted || plainText;
    } catch (e) {
      console.error('RSA encryption failed:', e);
      return plainText;
    }
  }
}
