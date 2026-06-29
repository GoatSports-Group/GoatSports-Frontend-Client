export enum NotificationType {
  OWNER_APPLICATION = 'OWNER_APPLICATION',
  SYSTEM = 'SYSTEM',
  USER = 'USER',
  BOOKING = 'BOOKING',
  PAYMENT = 'PAYMENT',
}

export const NOTIFICATION_TYPE_OPTIONS = [
  {
    value: NotificationType.OWNER_APPLICATION,
    label: 'Đơn đăng ký làm chủ sân',
  },
  {
    value: NotificationType.SYSTEM,
    label: 'Hệ thống',
  },
  {
    value: NotificationType.USER,
    label: 'Người dùng',
  },
  {
    value: NotificationType.BOOKING,
    label: 'Đặt sân',
  },
  {
    value: NotificationType.PAYMENT,
    label: 'Thanh toán',
  },
];
