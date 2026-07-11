import { NotificationStatus } from "@domain/enums/notification-status.enum";
import { NotificationType } from "@domain/enums/notification-type.enum";

export interface Notification {
  notificationId: string;
  receiverId: string;
  title: string;
  content: string;
  type: NotificationType;
  status: NotificationStatus;
  referenceId?: string;
  createdAt: string;
  readAt?: string;
}
