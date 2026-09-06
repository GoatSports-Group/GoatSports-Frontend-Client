import { BookingStatus } from '@domain/enums/booking-status.enum';
import { PaymentMethod } from '@domain/enums/payment-method.enum';

export interface Booking {
  bookingId: string;
  userId?: string;
  playerId?: string;
  venueCourtId: string;
  bookingDate: string;
  playDate?: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  source?: string;
  totalPrice: number;
  depositAmount: number;
  remainingAmount: number;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  depositPaymentId?: string;
  remainingPaymentId?: string;
  qrCode?: string;
  bookingCode: string;
  note?: string;
  checkedInAt?: string;
  holdExpiresAt?: string;
  createdAt: string;
  venueName?: string;
  courtName?: string;
}

export interface BookingCancellation {
  cancellationId: string;
  bookingId: string;
  requestedByUserId: string;
  reason: string;
  refundPercentage: number;
  refundAmount: number;
  status: string;
  processNote?: string;
  requestedAt: string;
  processedAt?: string;
}
