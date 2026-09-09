import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import JSEncrypt from 'jsencrypt';
import { GetPublicKeyUseCase } from '@application/usecase/auth/get-public-key.usecase';
import { EncryptedPayload } from '@application/dto/security/encrypted-payload.dto';

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
      if (!encrypted) {
        throw new Error('Không thể mã hóa dữ liệu');
      }
      return encrypted;
    } catch {
      throw new Error('Không thể mã hóa dữ liệu');
    }
  }

  async encryptPayload(payload: object, publicKeyBase64: string): Promise<EncryptedPayload> {
    try {
      const aesKey = await globalThis.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt']
      );
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
      const encryptedData = await globalThis.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        new TextEncoder().encode(JSON.stringify(payload))
      );
      const rawKey = await globalThis.crypto.subtle.exportKey('raw', aesKey);

      return {
        encryptedKey: this.encrypt(this.toBase64(rawKey), publicKeyBase64),
        iv: this.toBase64(iv),
        encryptedData: this.toBase64(encryptedData)
      };
    } catch {
      throw new Error('Không thể mã hóa dữ liệu tài khoản ngân hàng');
    }
  }

  private toBase64(value: ArrayBuffer | Uint8Array): string {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return globalThis.btoa(binary);
  }
}
