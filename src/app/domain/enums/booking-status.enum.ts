export enum BookingStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUND_PENDING = 'REFUND_PENDING',
  REFUNDED = 'REFUNDED',
  EXPIRED = 'EXPIRED',
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  [BookingStatus.PENDING_PAYMENT]: 'Chờ thanh toán',
  [BookingStatus.CONFIRMED]: 'Đã xác nhận',
  [BookingStatus.CHECKED_IN]: 'Đã nhận sân',
  [BookingStatus.COMPLETED]: 'Hoàn thành',
  [BookingStatus.CANCELLED]: 'Đã hủy',
  [BookingStatus.REFUND_PENDING]: 'Chờ hoàn cọc',
  [BookingStatus.REFUNDED]: 'Đã hoàn tiền',
  [BookingStatus.EXPIRED]: 'Đã hết hạn',
};

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  [BookingStatus.PENDING_PAYMENT]: 'amber',
  [BookingStatus.CONFIRMED]: 'emerald',
  [BookingStatus.CHECKED_IN]: 'blue',
  [BookingStatus.COMPLETED]: 'emerald',
  [BookingStatus.CANCELLED]: 'rose',
  [BookingStatus.REFUND_PENDING]: 'purple',
  [BookingStatus.REFUNDED]: 'slate',
  [BookingStatus.EXPIRED]: 'slate',
};
