export enum NotificationType {
  OWNER_APPLICATION = 'OWNER_APPLICATION',
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
  CLUB_FEE = 'CLUB_FEE',
  TOURNAMENT = 'TOURNAMENT',
  SYSTEM = 'SYSTEM',
}

export const NOTIFICATION_TYPE_OPTIONS = [
  {
    value: NotificationType.OWNER_APPLICATION,
    label: 'Đơn đăng ký làm chủ sân',
  },
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
