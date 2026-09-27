import { SelectOption } from '@shared/components/ui/select/select.component';
import { PostSport, PostVisibility } from '@application/dto/social-feed/social-feed.dto';
import { SPORT_LABEL } from '@presentation/pages/client/tournaments/tournament-view';

/** Nhan va bo loc dung chung cho bang tin, the bai viet va trang chi tiet bai viet. */
export type FeedTab = 'explore' | 'following' | 'saved' | 'mine' | 'friends';

export const FEED_TABS: ReadonlyArray<{ value: FeedTab; label: string; icon: string }> = [
  { value: 'explore', label: 'Khám phá', icon: 'compass' },
  { value: 'following', label: 'Đang theo dõi', icon: 'user-check' },
  { value: 'saved', label: 'Đã lưu', icon: 'bookmark' },
  { value: 'mine', label: 'Bài của tôi', icon: 'pencil' },
  { value: 'friends', label: 'Bạn bè', icon: 'users' }
];

export const POST_SPORTS: readonly PostSport[] = Object.keys(SPORT_LABEL) as PostSport[];

export function sportLabel(sport: PostSport | null | undefined): string {
  return sport ? SPORT_LABEL[sport] : '';
}

export const SPORT_SELECT_OPTIONS: readonly SelectOption[] = [
  { value: null, label: 'Chọn môn' },
  ...POST_SPORTS.map(value => ({ value, label: SPORT_LABEL[value] }))
];

export const VISIBILITY_META: Readonly<Record<PostVisibility, { label: string; icon: string }>> = {
  PUBLIC: { label: 'Công khai', icon: 'globe' },
  FRIENDS: { label: 'Bạn bè', icon: 'users' },
  PRIVATE: { label: 'Chỉ mình tôi', icon: 'lock' }
};

export const VISIBILITY_OPTIONS: readonly SelectOption[] =
  (Object.keys(VISIBILITY_META) as PostVisibility[]).map(value => ({ value, label: VISIBILITY_META[value].label }));

/** Ly do bao cao hay gap; nguoi dung van co the viet them. */
export const REPORT_REASONS: readonly string[] = [
  'Spam hoặc quảng cáo',
  'Ngôn từ xúc phạm, quấy rối',
  'Thông tin sai sự thật',
  'Hình ảnh không phù hợp',
  'Lừa đảo, gian lận kèo'
];

export function relativeTime(value: string | null | undefined): string {
  const timestamp = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(timestamp)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'Vừa xong';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} ngày trước`;
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(timestamp));
}

export function compactCount(value: number): string {
  if (value < 1000) return String(value);
  return new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function errorMessage(error: unknown, fallback: string): string {
  const response = error as { error?: { message?: unknown; error?: unknown; detail?: unknown } };
  for (const candidate of [response.error?.message, response.error?.detail, response.error?.error]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  return fallback;
}

export { richText, foldText } from './rich-text';
export type { TextSegment } from './rich-text';
