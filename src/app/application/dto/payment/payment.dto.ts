export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

export interface Payment {
  paymentId: string;
  payerId: string;
  purpose: 'BOOKING_DEPOSIT' | 'BOOKING_REMAINING' | 'CLUB_FEE' | 'TOURNAMENT_FEE';
  referenceType: 'BOOKING' | 'CLUB_FEE' | 'TOURNAMENT_REGISTRATION';
  referenceId: string;
  amount: number;
  currency: string;
  description?: string;
  status: PaymentStatus;
  expiresAt?: string;
  paidAt?: string;
  createdAt: string;
}

export interface PaymentAttempt {
  attemptId: string;
  paymentId: string;
  provider: 'PAYOS';
  method: 'BANK_TRANSFER';
  checkoutUrl?: string;
  deeplink?: string;
  qrCodeContent?: string;
  status: 'CREATED' | 'REDIRECT_READY' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';
  failureCode?: string;
  failureReason?: string;
  initiatedAt: string;
}

export interface CreatePaymentRequest {
  referenceType: 'BOOKING' | 'CLUB_FEE' | 'TOURNAMENT_REGISTRATION';
  referenceId: string;
  purpose: 'BOOKING_DEPOSIT' | 'BOOKING_REMAINING' | 'CLUB_FEE' | 'TOURNAMENT_FEE';
  amount: number;
  currency: 'VND';
  description: string;
  expiresAt?: string;
}

export interface CreatePaymentAttemptRequest {
  method: 'BANK_TRANSFER';
  locale: 'vn';
}

export interface BookingDepositCheckout {
  payment: Payment;
  attempt: PaymentAttempt;
}

export type PaymentCheckout = BookingDepositCheckout;
