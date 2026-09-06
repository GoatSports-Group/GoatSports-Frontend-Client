export { Booking, BookingCancellation } from '@domain/entities/booking';
export { TimeSlot } from '@domain/entities/time-slot';
export { BookingStatus, BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from '@domain/enums/booking-status.enum';
export { TimeSlotStatus, TIME_SLOT_STATUS_LABELS } from '@domain/enums/time-slot-status.enum';
export { PaymentMethod, PAYMENT_METHOD_OPTIONS } from '@domain/enums/payment-method.enum';
export { CancellationStatus, CANCELLATION_STATUS_LABELS } from '@domain/enums/cancellation-status.enum';

export interface CreateBookingRequest {
  venueCourtId: string;
  playDate: string;
  startTime: string;
  endTime: string;
}

export interface CancelBookingRequest {
  reason: string;
}

export interface CheckInRequest {
  bookingId?: string;
  qrCode?: string;
  bookingCode?: string;
}
