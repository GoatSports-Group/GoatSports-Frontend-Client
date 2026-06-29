export enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
}

export const NOTIFICATION_STATUS_OPTIONS = [
  {
    value: NotificationStatus.UNREAD,
    label: 'Chưa đọc',
  },
  {
    value: NotificationStatus.READ,
    label: 'Đã đọc',
  },
];
