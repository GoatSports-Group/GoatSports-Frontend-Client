export enum BookingStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUND_REQUESTED = 'REFUND_REQUESTED',
  REFUND_PROCESSING = 'REFUND_PROCESSING',
  REFUNDED = 'REFUNDED',
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  [BookingStatus.PENDING_PAYMENT]: 'Chờ thanh toán',
  [BookingStatus.CONFIRMED]: 'Đã xác nhận',
  [BookingStatus.CHECKED_IN]: 'Đã nhận sân',
  [BookingStatus.COMPLETED]: 'Hoàn thành',
  [BookingStatus.CANCELLED]: 'Đã hủy',
  [BookingStatus.REFUND_REQUESTED]: 'Yêu cầu hoàn cọc',
  [BookingStatus.REFUND_PROCESSING]: 'Đang hoàn cọc',
  [BookingStatus.REFUNDED]: 'Đã hoàn tiền',
};

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  [BookingStatus.PENDING_PAYMENT]: 'amber',
  [BookingStatus.CONFIRMED]: 'emerald',
  [BookingStatus.CHECKED_IN]: 'blue',
  [BookingStatus.COMPLETED]: 'emerald',
  [BookingStatus.CANCELLED]: 'rose',
  [BookingStatus.REFUND_REQUESTED]: 'purple',
  [BookingStatus.REFUND_PROCESSING]: 'purple',
  [BookingStatus.REFUNDED]: 'slate',
};
