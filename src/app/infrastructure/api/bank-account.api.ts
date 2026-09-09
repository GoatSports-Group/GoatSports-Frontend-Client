import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import {
  BankAccount,
  BankDirectoryEntry,
  RefundResult
} from '@application/dto/payment/bank-account.dto';
import { EncryptedPayload } from '@application/dto/security/encrypted-payload.dto';
import { API_ENDPOINTS } from '@infrastructure/config/api-endpoints';

@Injectable({ providedIn: 'root' })
export class BankAccountApi {
  private readonly http = inject(HttpClient);
  private readonly apiBase = API_ENDPOINTS.payment;

  getBanks(): Observable<BaseResponse<BankDirectoryEntry[]>> {
    return this.http.get<BaseResponse<BankDirectoryEntry[]>>(`${this.apiBase}/banks`);
  }

  getMyAccounts(): Observable<BaseResponse<BankAccount[]>> {
    return this.http.get<BaseResponse<BankAccount[]>>(`${this.apiBase}/bank-accounts/me`);
  }

  getEncryptionPublicKey(): Observable<BaseResponse<{ publicKey: string }>> {
    return this.http.get<BaseResponse<{ publicKey: string }>>(`${this.apiBase}/bank-accounts/public-key`);
  }

  link(request: EncryptedPayload): Observable<BaseResponse<BankAccount>> {
    return this.http.post<BaseResponse<BankAccount>>(`${this.apiBase}/bank-accounts`, request);
  }

  makeDefault(request: EncryptedPayload): Observable<BaseResponse<BankAccount>> {
    return this.http.patch<BaseResponse<BankAccount>>(`${this.apiBase}/bank-accounts/default`, request);
  }

  disable(request: EncryptedPayload): Observable<void> {
    return this.http.patch<void>(`${this.apiBase}/bank-accounts/disable`, request);
  }

  claimRefund(refundId: string): Observable<BaseResponse<RefundResult>> {
    return this.http.post<BaseResponse<RefundResult>>(`${this.apiBase}/refunds/${refundId}/claim`, {});
  }
}
