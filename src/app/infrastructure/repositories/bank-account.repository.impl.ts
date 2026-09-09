import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  BankAccount,
  BankDirectoryEntry,
  RefundResult
} from '@application/dto/payment/bank-account.dto';
import { EncryptedPayload } from '@application/dto/security/encrypted-payload.dto';
import { BankAccountRepository } from '@application/ports/persistence/bank-account.repository';
import { BankAccountApi } from '@infrastructure/api/bank-account.api';

@Injectable({ providedIn: 'root' })
export class BankAccountRepositoryImpl implements BankAccountRepository {
  private readonly api = inject(BankAccountApi);

  getBanks(): Observable<BankDirectoryEntry[]> {
    return this.api.getBanks().pipe(map(response => response.data ?? []));
  }

  getMyAccounts(): Observable<BankAccount[]> {
    return this.api.getMyAccounts().pipe(map(response => response.data ?? []));
  }

  getEncryptionPublicKey(): Observable<string> {
    return this.api.getEncryptionPublicKey().pipe(map(response => this.requireData(response.data).publicKey));
  }

  link(request: EncryptedPayload): Observable<BankAccount> {
    return this.api.link(request).pipe(map(response => this.requireData(response.data)));
  }

  makeDefault(request: EncryptedPayload): Observable<BankAccount> {
    return this.api.makeDefault(request).pipe(map(response => this.requireData(response.data)));
  }

  disable(request: EncryptedPayload): Observable<void> {
    return this.api.disable(request);
  }

  claimRefund(refundId: string): Observable<RefundResult> {
    return this.api.claimRefund(refundId).pipe(map(response => this.requireData(response.data)));
  }

  private requireData<T>(data: T | null | undefined): T {
    if (data == null) throw new Error('Payment service không trả dữ liệu.');
    return data;
  }
}
