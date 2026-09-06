import { BookingStatus } from '@domain/enums/booking-status.enum';
import { PaymentMethod } from '@domain/enums/payment-method.enum';

export interface Booking {
  bookingId: string;
  userId: string;
  venueCourtId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  totalPrice: number;
  depositAmount: number;
  remainingAmount: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  qrCode?: string;
  bookingCode: string;
  note?: string;
  checkedInAt?: string;
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
