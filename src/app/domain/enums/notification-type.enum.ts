export enum NotificationType {
  BOOKING = 'BOOKING',
  CHECK_IN = 'CHECK_IN',
  REVIEW = 'REVIEW',
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
  MATCHMAKING = 'MATCHMAKING',
  FRIENDSHIP = 'FRIENDSHIP',
  MESSAGE = 'MESSAGE',
  CONTENT_MODERATION = 'CONTENT_MODERATION',
  CLUB = 'CLUB',
  TOURNAMENT = 'TOURNAMENT',
  SYSTEM = 'SYSTEM',
}

export const NOTIFICATION_TYPE_OPTIONS = [
  {
    value: NotificationType.BOOKING,
    label: 'Đặt sân',
  },
  {
    value: NotificationType.PAYMENT,
    label: 'Thanh toán',
  },
  {
    value: NotificationType.SYSTEM,
    label: 'Hệ thống',
  },
];
