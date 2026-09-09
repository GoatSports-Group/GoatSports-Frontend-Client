import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import {
  BankAccount,
  BankDirectoryEntry,
  LinkBankAccountRequest,
  RefundResult
} from '@application/dto/payment/bank-account.dto';
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

  link(request: LinkBankAccountRequest): Observable<BaseResponse<BankAccount>> {
    return this.http.post<BaseResponse<BankAccount>>(`${this.apiBase}/bank-accounts`, request);
  }

  makeDefault(bankAccountId: string): Observable<BaseResponse<BankAccount>> {
    return this.http.patch<BaseResponse<BankAccount>>(
      `${this.apiBase}/bank-accounts/${bankAccountId}/default`, {}
    );
  }

  disable(bankAccountId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBase}/bank-accounts/${bankAccountId}`);
  }

  claimRefund(refundId: string): Observable<BaseResponse<RefundResult>> {
    return this.http.post<BaseResponse<RefundResult>>(`${this.apiBase}/refunds/${refundId}/claim`, {});
  }
}
