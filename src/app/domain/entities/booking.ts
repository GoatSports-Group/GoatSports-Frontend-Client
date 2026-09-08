import { BookingStatus } from '@domain/enums/booking-status.enum';
import { CancellationStatus } from '@domain/enums/cancellation-status.enum';
import { PaymentMethod } from '@domain/enums/payment-method.enum';

export interface Booking {
  bookingId: string;
  userId?: string;
  playerId?: string;
  venueCourtId: string;
  venueId?: string;
  playDate: string;
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
  cancellationPolicy?: CancellationPolicy;
  cancellation?: BookingCancellation;
  review?: PlayerReview;
}

export interface BookingCancellation {
  cancellationId: string;
  bookingId: string;
  requestedByUserId: string;
  refundId?: string;
  reason: string;
  refundPercentage: number;
  refundAmount: number;
  status: CancellationStatus;
  reviewMode: 'AUTOMATIC' | 'OWNER_REVIEW';
  processedBy?: string;
  decisionReason?: string;
  processedAt?: string;
  createdAt: string;
}

export interface CancellationPolicy {
  fullRefundHoursBefore: number;
  partialRefundHoursBefore: number;
  partialRefundPercentage: number;
  noRefundHoursBefore: number;
}

export interface PlayerReview {
  reviewId: string;
  venueId: string;
  bookingId: string;
  rating: number;
  content?: string;
  status: string;
  createdAt: string;
}
