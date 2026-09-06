import { Injectable } from '@angular/core';

export interface PendingBookingPayment {
  bookingId: string;
  paymentId: string;
  expiresAt?: string;
}

@Injectable({ providedIn: 'root' })
export class PendingBookingPaymentService {
  private readonly storageKey = 'goatsports.pending-booking-payment';

  save(value: PendingBookingPayment): void {
    sessionStorage.setItem(this.storageKey, JSON.stringify(value));
  }

  get(): PendingBookingPayment | null {
    try {
      const raw = sessionStorage.getItem(this.storageKey);
      if (!raw) return null;
      const value = JSON.parse(raw) as Partial<PendingBookingPayment>;
      return typeof value.bookingId === 'string' && typeof value.paymentId === 'string'
        ? { bookingId: value.bookingId, paymentId: value.paymentId, expiresAt: value.expiresAt }
        : null;
    } catch {
      return null;
    }
  }

  clear(): void {
    sessionStorage.removeItem(this.storageKey);
  }
}
