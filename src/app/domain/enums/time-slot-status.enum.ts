export enum TimeSlotStatus {
  AVAILABLE = 'AVAILABLE',
  LOCKED = 'LOCKED',
  BOOKED = 'BOOKED',
  MAINTENANCE = 'MAINTENANCE',
}

export const TIME_SLOT_STATUS_LABELS: Record<TimeSlotStatus, string> = {
  [TimeSlotStatus.AVAILABLE]: 'Còn trống',
  [TimeSlotStatus.LOCKED]: 'Đang giữ chỗ',
  [TimeSlotStatus.BOOKED]: 'Đã đặt',
  [TimeSlotStatus.MAINTENANCE]: 'Bảo trì',
};
