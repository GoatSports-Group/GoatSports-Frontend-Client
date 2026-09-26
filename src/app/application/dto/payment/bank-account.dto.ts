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

/** Một khoản hoàn tiền của người chơi (payment-service GET /refunds/me). */
export interface MyRefund {
  refundId: string;
  paymentId: string;
  amount: number;
  status: 'CREATED' | 'AWAITING_CLAIM' | 'AWAITING_BANK_ACCOUNT' | 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'MANUAL_REVIEW';
  reason?: string;
  failureReason?: string;
  refundedAt?: string;
  createdAt?: string;
  purpose?: 'BOOKING_DEPOSIT' | 'BOOKING_REMAINING' | 'TOURNAMENT_FEE';
  referenceType?: 'BOOKING' | 'TOURNAMENT_REGISTRATION';
  referenceId?: string;
  description?: string;
  /** Người chơi tự bấm nhận / thử lại được. */
  claimable: boolean;
}
