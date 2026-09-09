import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  BankAccount,
  BankDirectoryEntry,
  LinkBankAccountRequest,
  RefundResult
} from '@application/dto/payment/bank-account.dto';

export interface BankAccountRepository {
  getBanks(): Observable<BankDirectoryEntry[]>;
  getMyAccounts(): Observable<BankAccount[]>;
  link(request: LinkBankAccountRequest): Observable<BankAccount>;
  makeDefault(bankAccountId: string): Observable<BankAccount>;
  disable(bankAccountId: string): Observable<void>;
  claimRefund(refundId: string): Observable<RefundResult>;
}

export const BANK_ACCOUNT_REPOSITORY_TOKEN = new InjectionToken<BankAccountRepository>(
  'BANK_ACCOUNT_REPOSITORY_TOKEN'
);
