import { Injectable } from '@angular/core';

export type PendingPaymentContext =
  | { kind?: 'BOOKING'; bookingId: string; paymentId: string; expiresAt?: string; matchmakingSessionId?: string }
  | { kind: 'TOURNAMENT'; tournamentId: string; registrationId: string; paymentId: string };
export type PendingBookingPayment = Extract<PendingPaymentContext, { bookingId: string }>;

@Injectable({ providedIn: 'root' })
export class PendingBookingPaymentService {
  private readonly storageKey = 'goatsports.pending-booking-payment';
  save(value: PendingPaymentContext): void { sessionStorage.setItem(this.storageKey, JSON.stringify(value)); }
  get(): PendingPaymentContext | null {
    try {
      const value = JSON.parse(sessionStorage.getItem(this.storageKey) ?? 'null') as Record<string, unknown> | null;
      if (!value || typeof value['paymentId'] !== 'string') return null;
      if (value['kind'] === 'TOURNAMENT' && typeof value['tournamentId'] === 'string' && typeof value['registrationId'] === 'string') {
        return { kind: 'TOURNAMENT', tournamentId: value['tournamentId'], registrationId: value['registrationId'], paymentId: value['paymentId'] };
      }
      if (typeof value['bookingId'] === 'string') {
        return { kind: 'BOOKING', bookingId: value['bookingId'], paymentId: value['paymentId'],
          expiresAt: typeof value['expiresAt'] === 'string' ? value['expiresAt'] : undefined,
          matchmakingSessionId: typeof value['matchmakingSessionId'] === 'string' ? value['matchmakingSessionId'] : undefined };
      }
      return null;
    } catch { return null; }
  }
  clear(): void { sessionStorage.removeItem(this.storageKey); }
}
