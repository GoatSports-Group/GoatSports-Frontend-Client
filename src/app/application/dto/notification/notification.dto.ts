import type { Notification } from '@domain/entities/notification';
import { NotificationStatus } from '@domain/enums/notification-status.enum';

export type { Notification } from '@domain/entities/notification';
export { NotificationStatus, NOTIFICATION_STATUS_OPTIONS } from '@domain/enums/notification-status.enum';
export { NotificationType, NOTIFICATION_TYPE_OPTIONS } from '@domain/enums/notification-type.enum';

export interface NotificationQuery {
  status?: NotificationStatus;
  page: number;
  pageSize: number;
}

export interface NotificationPage {
  items: Notification[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Thông báo sau một mốc, cũ nhất trước; `hasMore` thì gọi tiếp với mốc là phần tử cuối. */
export interface NotificationCatchUpPage {
  items: Notification[];
  hasMore: boolean;
}
