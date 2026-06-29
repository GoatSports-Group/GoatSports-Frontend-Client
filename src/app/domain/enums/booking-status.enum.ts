export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export const BOOKING_STATUS_OPTIONS = [
  {
    value: BookingStatus.PENDING,
    label: 'Chờ xác nhận',
  },
  {
    value: BookingStatus.CONFIRMED,
    label: 'Đã xác nhận',
  },
  {
    value: BookingStatus.COMPLETED,
    label: 'Đã hoàn thành',
  },
  {
    value: BookingStatus.CANCELLED,
    label: 'Đã hủy',
  },
];
