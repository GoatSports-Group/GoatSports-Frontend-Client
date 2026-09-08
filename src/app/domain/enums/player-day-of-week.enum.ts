export enum PlayerDayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY'
}

export const PLAYER_DAY_OPTIONS = [
  { value: PlayerDayOfWeek.MONDAY, label: 'Thứ Hai' },
  { value: PlayerDayOfWeek.TUESDAY, label: 'Thứ Ba' },
  { value: PlayerDayOfWeek.WEDNESDAY, label: 'Thứ Tư' },
  { value: PlayerDayOfWeek.THURSDAY, label: 'Thứ Năm' },
  { value: PlayerDayOfWeek.FRIDAY, label: 'Thứ Sáu' },
  { value: PlayerDayOfWeek.SATURDAY, label: 'Thứ Bảy' },
  { value: PlayerDayOfWeek.SUNDAY, label: 'Chủ Nhật' }
] as const;
