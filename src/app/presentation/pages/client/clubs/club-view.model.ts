import { Club, ClubActivity, ClubPrivacy, ClubRole, MyClubMembership, SportType } from '@application/dto/club/club.dto';

/** Hành động hiện trên nút của mỗi thẻ CLB, suy ra từ tư cách thành viên của người đang xem. */
export type ClubAction = 'DETAIL' | 'JOIN' | 'REQUEST' | 'PENDING';
export type ClubSortMode = 'RELEVANCE' | 'MEMBERS' | 'WIN_RATE';

export const DEFAULT_CLUB_LOGO = '/assets/images/goat.png';
export const DEFAULT_CLUB_BANNER = '/assets/images/default-banner-light.png';

export const CLUB_SPORTS: ReadonlyArray<{ label: string; value: SportType | 'ALL'; icon: string }> = [
  { label: 'Tất cả môn', value: 'ALL', icon: 'trophy' },
  { label: 'Bóng đá', value: 'FOOTBALL', icon: 'circle-dot' },
  { label: 'Cầu lông', value: 'BADMINTON', icon: 'zap' },
  { label: 'Tennis', value: 'TENNIS', icon: 'circle' },
  { label: 'Bóng rổ', value: 'BASKETBALL', icon: 'circle-dot-dashed' },
  { label: 'Pickleball', value: 'PICKLEBALL', icon: 'target' },
  { label: 'Bóng chuyền', value: 'VOLLEYBALL', icon: 'circle' }
];

export const CLUB_SORT_OPTIONS = [
  { label: 'Nổi bật trước', value: 'RELEVANCE', icon: 'sparkles' },
  { label: 'Nhiều thành viên', value: 'MEMBERS', icon: 'users' },
  { label: 'Tỉ lệ thắng cao', value: 'WIN_RATE', icon: 'trophy' }
] as const;

export const MY_CLUB_SORT_OPTIONS = [
  { label: 'Mới nhất', value: 'NEWEST', icon: 'clock-3' },
  { label: 'Tên A–Z', value: 'NAME', icon: 'arrow-down-a-z' },
  { label: 'Nhiều thành viên', value: 'MEMBERS', icon: 'users' }
] as const;

export const CLUB_PRIVACY_OPTIONS = [
  { label: 'Công khai', value: 'PUBLIC', icon: 'globe-2' },
  { label: 'Riêng tư', value: 'PRIVATE', icon: 'lock' }
] as const;

export const CLUB_APPROVAL_OPTIONS = [
  { label: 'Tự động duyệt', value: 'AUTO', icon: 'circle-check' },
  { label: 'Ban quản trị duyệt', value: 'MANUAL', icon: 'user-check' }
] as const;

const SPORT_LABELS: Record<SportType, string> = {
  FOOTBALL: 'Bóng đá',
  BADMINTON: 'Cầu lông',
  TENNIS: 'Tennis',
  BASKETBALL: 'Bóng rổ',
  PICKLEBALL: 'Pickleball',
  VOLLEYBALL: 'Bóng chuyền'
};

export function sportLabel(value: SportType): string {
  return SPORT_LABELS[value] ?? value;
}

const ROLE_LABELS: Record<ClubRole, string> = {
  OWNER: 'Chủ CLB',
  ADMIN: 'Quản trị viên',
  MEMBER: 'Thành viên'
};

/** Dữ liệu một thẻ CLB trên giao diện. Mọi trường đều đến từ API, không có số bịa. */
export interface ClubCardView {
  clubId: string;
  name: string;
  sportType: SportType;
  city: string;
  location: string;
  description: string;
  tags: string[];
  memberCount: number;
  winRate: number;
  privacy: ClubPrivacy;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  action: ClubAction;
  /** Nhãn phụ bên phải tên CLB: vai trò của tôi, hoặc rỗng nếu tôi chưa tham gia. */
  activityLabel: string;
}

export interface ActivityView {
  activityId: string;
  clubId: string;
  day: string;
  date: string;
  month: string;
  title: string;
  clubName: string;
  location: string;
  time: string;
  description: string;
  startAt: string;
  endAt: string;
}

const WEEKDAYS = ['CN', 'TH 2', 'TH 3', 'TH 4', 'TH 5', 'TH 6', 'TH 7'];

/**
 * Nút nào hiện ra phụ thuộc vào tôi đã ở trong CLB chưa và CLB có duyệt tay không.
 * Đưa vào một chỗ để thẻ CLB ở mọi khối đều nhất quán.
 */
export function toCardView(club: Club, membership?: MyClubMembership): ClubCardView {
  return {
    clubId: club.clubId,
    name: club.name,
    sportType: club.sportType,
    city: club.city ?? '',
    location: club.location ?? '',
    description: club.description ?? '',
    tags: club.tags ?? [],
    memberCount: club.memberCount ?? 0,
    winRate: Math.round((club.winRate ?? 0) * 100) / 100,
    privacy: club.privacy,
    logoUrl: club.logoUrl ?? null,
    bannerUrl: club.bannerUrl ?? null,
    action: resolveAction(club, membership),
    activityLabel: membership?.status === 'ACTIVE' ? ROLE_LABELS[membership.role] : ''
  };
}

function resolveAction(club: Club, membership?: MyClubMembership): ClubAction {
  if (membership?.status === 'ACTIVE') return 'DETAIL';
  if (membership?.status === 'PENDING') return 'PENDING';
  return club.approvalMode === 'MANUAL' ? 'REQUEST' : 'JOIN';
}

export function toActivityView(activity: ClubActivity, clubName: string): ActivityView {
  const start = new Date(activity.startAt);
  const end = activity.endAt ? new Date(activity.endAt) : null;
  return {
    activityId: activity.activityId,
    clubId: activity.clubId,
    day: WEEKDAYS[start.getDay()],
    date: String(start.getDate()).padStart(2, '0'),
    month: 'THG ' + (start.getMonth() + 1),
    title: activity.title,
    clubName,
    location: activity.description?.trim() || '',
    time: formatTime(start) + (end ? ' – ' + formatTime(end) : ''),
    description: activity.description?.trim() || '',
    startAt: activity.startAt,
    endAt: activity.endAt
  };
}

function formatTime(value: Date): string {
  return String(value.getHours()).padStart(2, '0') + ':' + String(value.getMinutes()).padStart(2, '0');
}
