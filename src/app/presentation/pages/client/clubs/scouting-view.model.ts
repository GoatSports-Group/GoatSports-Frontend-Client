import { PLAYER_DAY_OPTIONS } from '@domain/enums/player-day-of-week.enum';
import { ScoutingAvailabilityModel, ScoutingWeekDay, SkillLevel } from '@application/dto/club/club.dto';

/** Nhan hien thi dung chung cho bang tuyen thanh vien (trang + panel ho so). */
export function skillLabel(value?: SkillLevel): string {
  switch (value) {
    case 'BEGINNER': return 'Mới bắt đầu';
    case 'INTERMEDIATE': return 'Trung bình';
    case 'ADVANCED': return 'Nâng cao';
    case 'PRO': return 'Chuyên nghiệp';
    default: return 'Chưa rõ trình độ';
  }
}

export function initialsOf(name?: string): string {
  return (name ?? '').trim().split(/\s+/).slice(-2).map(part => part.charAt(0).toUpperCase()).join('') || '?';
}

export function dayLabel(day: ScoutingWeekDay): string {
  return PLAYER_DAY_OPTIONS.find(option => option.value === day)?.label ?? day;
}

/** winRate tu API la ti le 0-1. */
export function formatWinRate(value?: number): string {
  return value == null ? '—' : `${Math.round(value * 100)}%`;
}

/** "18:00:00" -> "18:00" */
export function formatTime(value: string): string {
  return value?.slice(0, 5) ?? '';
}

export interface AvailabilityDay {
  day: ScoutingWeekDay;
  label: string;
  slots: string[];
}

/** Gom khung gio theo ngay, giu thu tu Thu Hai -> Chu Nhat. */
export function groupAvailability(slots: ReadonlyArray<ScoutingAvailabilityModel> = []): AvailabilityDay[] {
  return PLAYER_DAY_OPTIONS
    .map(option => ({
      day: option.value as ScoutingWeekDay,
      label: option.label,
      slots: slots.filter(slot => slot.dayOfWeek === option.value)
        .map(slot => `${formatTime(slot.startTime)} – ${formatTime(slot.endTime)}`)
    }))
    .filter(day => day.slots.length);
}
