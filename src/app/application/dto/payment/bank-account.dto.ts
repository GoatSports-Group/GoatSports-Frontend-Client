export type BankAccountStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'DISABLED';

export interface BankDirectoryEntry {
  id: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
  transferSupported: boolean;
  lookupSupported: boolean;
}

export interface BankAccount {
  bankAccountId: string;
  bankBin: string;
  accountNumberLast4: string;
  accountName: string;
  status: BankAccountStatus;
  isDefault: boolean;
  verifiedAt?: string;
  createdAt: string;
}

export interface LinkBankAccountRequest {
  bankBin: string;
  accountNumber: string;
  accountName: string;
}

export interface RefundResult {
  refundId: string;
  paymentId: string;
  amount: number;
  status: 'AWAITING_CLAIM' | 'AWAITING_BANK_ACCOUNT' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  failureReason?: string;
}
