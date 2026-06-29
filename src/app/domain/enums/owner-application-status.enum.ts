export enum OwnerApplicationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export const OWNER_APPLICATION_STATUS_OPTIONS = [
  {
    value: OwnerApplicationStatus.PENDING,
    label: 'Đang chờ',
  },
  {
    value: OwnerApplicationStatus.APPROVED,
    label: 'Chấp nhận',
  },
  {
    value: OwnerApplicationStatus.REJECTED,
    label: 'Từ chối',
  },
  {
    value: OwnerApplicationStatus.CANCELLED,
    label: 'Hủy',
  },
];
