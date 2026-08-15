import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import JSEncrypt from 'jsencrypt';
import { GetPublicKeyUseCase } from '@application/usecase/auth/get-public-key.usecase';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  private getPublicKeyUseCase = inject(GetPublicKeyUseCase);
  private cachedPublicKey: string | null = null;

  getPublicKey(): Observable<string> {
    if (this.cachedPublicKey) {
      return of(this.cachedPublicKey);
    }

    return this.getPublicKeyUseCase.execute().pipe(
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
