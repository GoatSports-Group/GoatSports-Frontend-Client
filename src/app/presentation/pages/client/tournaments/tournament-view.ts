import { SelectOption } from '@shared/components/ui/select/select.component';
import { SportType } from '@domain/models/club.model';
import {
  EligibilityRuleOperator, EligibilityRuleType, FeePaymentStatus, LineupMemberStatus, LineupRole, RegistrationStatus,
  SkillLevel, TournamentFormat, TournamentModel, TournamentStatus
} from '@domain/models/tournament.model';

/** Tong mau theo GOAT-DESIGN §3 (status tone pairs). */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral';

export const SPORT_LABEL: Readonly<Record<SportType, string>> = {
  FOOTBALL: 'Bóng đá', BADMINTON: 'Cầu lông', TENNIS: 'Tennis',
  PICKLEBALL: 'Pickleball', BASKETBALL: 'Bóng rổ', VOLLEYBALL: 'Bóng chuyền'
};

export const SPORT_OPTIONS: readonly SelectOption[] =
  (Object.keys(SPORT_LABEL) as SportType[]).map(value => ({ value, label: SPORT_LABEL[value] }));

export const STATUS_META: Readonly<Record<TournamentStatus, { label: string; tone: Tone }>> = {
  DRAFT: { label: 'Bản nháp', tone: 'neutral' },
  PUBLISHED: { label: 'Sắp mở đăng ký', tone: 'info' },
  REGISTRATION_OPEN: { label: 'Đang mở đăng ký', tone: 'success' },
  REGISTRATION_CLOSED: { label: 'Đã đóng đăng ký', tone: 'warning' },
  IN_PROGRESS: { label: 'Đang diễn ra', tone: 'primary' },
  COMPLETED: { label: 'Đã kết thúc', tone: 'neutral' },
  CANCELLED: { label: 'Đã hủy', tone: 'danger' }
};

/** Trang thai co the loc tren trang kham pha (ban nhap khong bao gio cong khai). */
export const STATUS_FILTER_OPTIONS: readonly SelectOption[] = [
  { value: '', label: 'Mọi trạng thái' },
  // Khám phá không liệt kê giải đã hủy (club-service lọc sẵn), nên không có lựa chọn "Đã hủy".
  ...(['REGISTRATION_OPEN', 'PUBLISHED', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED'] as TournamentStatus[])
    .map(value => ({ value, label: STATUS_META[value].label }))
];

export const REGISTRATION_META: Readonly<Record<RegistrationStatus, { label: string; tone: Tone }>> = {
  PENDING_MEMBERS: { label: 'Chờ đủ thành viên', tone: 'info' },
  PENDING_ELIGIBILITY: { label: 'Chờ xét điều kiện', tone: 'warning' },
  PENDING_PAYMENT: { label: 'Chờ thanh toán', tone: 'warning' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'success' },
  REJECTED: { label: 'Bị từ chối', tone: 'danger' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' }
};

export const PAYMENT_META: Readonly<Record<FeePaymentStatus, { label: string; tone: Tone }>> = {
  PENDING: { label: 'Chưa đóng phí', tone: 'warning' },
  SUCCEEDED: { label: 'Đã đóng phí', tone: 'success' },
  FAILED: { label: 'Thanh toán lỗi', tone: 'danger' },
  WAIVED: { label: 'Miễn phí', tone: 'neutral' },
  REFUND_REQUESTED: { label: 'Đang hoàn phí', tone: 'info' }
};

export const MEMBER_META: Readonly<Record<LineupMemberStatus, { label: string; tone: Tone }>> = {
  INVITED: { label: 'Chờ nhận lời', tone: 'warning' },
  ACCEPTED: { label: 'Đã tham gia', tone: 'success' },
  DECLINED: { label: 'Từ chối', tone: 'neutral' }
};

/** Dang ky con giu suat trong giai. */
export const HOLDING_STATUSES: ReadonlySet<RegistrationStatus> =
  new Set(['PENDING_MEMBERS', 'PENDING_ELIGIBILITY', 'PENDING_PAYMENT', 'CONFIRMED']);

export const FORMAT_LABEL: Readonly<Record<TournamentFormat, string>> = {
  SINGLE_ELIMINATION: 'Loại trực tiếp',
  ROUND_ROBIN: 'Vòng tròn'
};

export const SKILL_LABEL: Readonly<Record<SkillLevel, string>> = {
  BEGINNER: 'Mới chơi', INTERMEDIATE: 'Trung bình', ADVANCED: 'Nâng cao', PRO: 'Chuyên nghiệp'
};

export const SKILL_OPTIONS: readonly SelectOption[] =
  (Object.keys(SKILL_LABEL) as SkillLevel[]).map(value => ({ value, label: SKILL_LABEL[value] }));

export const LINEUP_ROLE_LABEL: Readonly<Record<LineupRole, string>> = {
  CAPTAIN: 'Đội trưởng', PLAYER: 'Thi đấu', SUBSTITUTE: 'Dự bị'
};

export const LINEUP_ROLE_OPTIONS: readonly SelectOption[] =
  (Object.keys(LINEUP_ROLE_LABEL) as LineupRole[]).map(value => ({ value, label: LINEUP_ROLE_LABEL[value] }));

const GENDER_LABEL: Readonly<Record<string, string>> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };

/** "Tuổi từ 18", "Trình độ tối đa Trung bình", "Chỉ dành cho Nữ"... */
export function ruleLabel(rule: { ruleType: EligibilityRuleType; operator: EligibilityRuleOperator; expectedValue: string }): string {
  const raw = (rule.expectedValue ?? '').trim();
  const value = rule.ruleType === 'SKILL_LEVEL'
    ? raw.split(',').map(item => SKILL_LABEL[item.trim().toUpperCase() as SkillLevel] ?? item.trim()).join(', ')
    : rule.ruleType === 'GENDER'
      ? raw.split(',').map(item => GENDER_LABEL[item.trim().toUpperCase()] ?? item.trim()).join(', ')
      : raw;
  if (rule.ruleType === 'GENDER') return rule.operator === 'NOT_EQUAL' ? `Không dành cho ${value}` : `Chỉ dành cho ${value}`;
  if (rule.ruleType === 'CLUB_MEMBERSHIP') return 'Chỉ thành viên câu lạc bộ được chỉ định';
  const subject = { AGE: 'Tuổi', SKILL_LEVEL: 'Trình độ', ELO_RATING: 'Điểm ELO', TEAM_SIZE: 'Đội hình' }[rule.ruleType];
  const unit = rule.ruleType === 'TEAM_SIZE' ? ' người' : '';
  switch (rule.operator) {
    case 'GREATER_THAN_OR_EQUAL': return `${subject} từ ${value}${unit}`;
    case 'GREATER_THAN': return `${subject} trên ${value}${unit}`;
    case 'LESS_THAN_OR_EQUAL': return `${subject} tối đa ${value}${unit}`;
    case 'LESS_THAN': return `${subject} dưới ${value}${unit}`;
    case 'NOT_EQUAL': return `${subject} khác ${value}${unit}`;
    case 'IN': return `${subject}: ${value}`;
    case 'BETWEEN': {
      const [low, high] = value.split(/[,-]/).map(item => item.trim());
      return `${subject} từ ${low} đến ${high}${unit}`;
    }
    default: return `${subject} đúng ${value}${unit}`;
  }
}

export function formatVnd(amount: number | null | undefined): string {
  if (!amount) return 'Miễn phí';
  return `${new Intl.NumberFormat('vi-VN').format(amount)} đ`;
}

/** Ngay dang yyyy-MM-dd theo gio dia phuong (khong dung toISOString vi lech UTC). */
export function isoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Ti le da lap day, 0–100, cho thanh tien do suat tham du. */
export function fillPercent(tournament: TournamentModel): number {
  if (!tournament.maxParticipants) return 0;
  return Math.min(100, Math.round((tournament.currentParticipants / tournament.maxParticipants) * 100));
}

/** Dong mo ta ngan nhat cho moc thoi gian quan trong tiep theo cua giai. */
export function nextMilestone(tournament: TournamentModel): string {
  const day = (value: string) => value.split('-').reverse().slice(0, 2).join('/');
  switch (tournament.status) {
    case 'PUBLISHED': return `Mở đăng ký ${day(tournament.registrationOpenDate)}`;
    case 'REGISTRATION_OPEN': return `Hạn đăng ký ${day(tournament.registrationCloseDate)}`;
    case 'REGISTRATION_CLOSED': return `Khai mạc ${day(tournament.startDate)}`;
    case 'IN_PROGRESS': return `Kết thúc ${day(tournament.endDate)}`;
    case 'COMPLETED': return `Đã kết thúc ${day(tournament.endDate)}`;
    case 'CANCELLED': return 'Giải đã hủy';
    default: return `Khai mạc ${day(tournament.startDate)}`;
  }
}

/** "Thứ 4, 24/09" / "Chủ nhật, 27/09" từ ngày dạng yyyy-MM-dd (app chưa đăng ký locale vi cho DatePipe). */
export function dayLabel(isoDateValue: string): string {
  const [year, month, day] = isoDateValue.split('-').map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  const name = weekday === 0 ? 'Chủ nhật' : `Thứ ${weekday + 1}`;
  return `${name}, ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}
