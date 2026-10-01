import { Booking, BookingStatus, BOOKING_STATUS_LABELS } from '@application/dto/booking/booking.dto';
import { SPORT_TYPE_OPTIONS } from '@application/dto/venue/venue.dto';
import { ClubActivityModel, ClubInvitationModel } from '@domain/models/club.model';
import { MatchmakingPlayer, MatchmakingSessionModel } from '@domain/models/matchmaking.model';
import { TeamInvitationModel, TournamentModel } from '@domain/models/tournament.model';

/** Trang chủ khi đã đăng nhập: gộp lịch và việc cần làm từ đặt sân, kèo AI, CLB và giải đấu. */

export type AgendaKind = 'BOOKING' | 'MATCH' | 'CLUB' | 'TOURNAMENT';
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface AgendaItem {
  id: string;
  kind: AgendaKind;
  title: string;
  subtitle: string;
  start: Date;
  end: Date;
  allDay: boolean;
  status?: { label: string; tone: Tone };
  link: string[];
  queryParams?: Record<string, string>;
}

export interface TaskItem {
  id: string;
  icon: string;
  tone: Tone;
  title: string;
  detail: string;
  /** Hạn chót (hết giờ phản hồi, hết giờ giữ sân); việc có hạn xếp trước. */
  deadline?: Date;
  link: string[];
  queryParams?: Record<string, string>;
}

export interface FrequentVenue {
  venueId: string;
  venueName: string;
  courtName?: string;
  visits: number;
  lastPlayed: Date;
}

const ACTIVE_SESSION = new Set([
  'PROPOSED', 'ACCEPTED_BY_ONE', 'ACCEPTED', 'VENUE_SELECTED', 'BOOKING_PENDING',
  'CONFIRMED', 'CHECKED_IN', 'RESULT_PENDING', 'DISPUTED'
]);
const UPCOMING_BOOKING = new Set<string>([BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]);
const PLAYED_BOOKING = new Set<string>([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.COMPLETED]);
const SESSION_STATUS: Record<string, { label: string; tone: Tone }> = {
  PROPOSED: { label: 'Chờ phản hồi', tone: 'warning' },
  ACCEPTED_BY_ONE: { label: 'Chờ phản hồi', tone: 'warning' },
  ACCEPTED: { label: 'Chọn sân', tone: 'info' },
  VENUE_SELECTED: { label: 'Chờ đặt sân', tone: 'warning' },
  BOOKING_PENDING: { label: 'Chờ cọc', tone: 'warning' },
  CONFIRMED: { label: 'Đã chốt', tone: 'success' },
  CHECKED_IN: { label: 'Đã nhận sân', tone: 'success' },
  RESULT_PENDING: { label: 'Chờ tỷ số', tone: 'warning' },
  DISPUTED: { label: 'Lệch tỷ số', tone: 'danger' }
};
const BOOKING_TONE: Record<string, Tone> = {
  [BookingStatus.PENDING_PAYMENT]: 'warning',
  [BookingStatus.CONFIRMED]: 'success',
  [BookingStatus.CHECKED_IN]: 'info'
};

export function sportLabel(sport: string | null | undefined): string {
  return SPORT_TYPE_OPTIONS.find(option => option.value === sport)?.label ?? sport ?? '';
}

/**
 * Ngày giờ do backend trả theo giờ Việt Nam ("2026-10-02" + "18:00:00"); máy người dùng cũng ở giờ này.
 * Backend trả null cho trường trống (vd. giải không đặt giờ mỗi ngày): thiếu giờ là 00:00, thiếu ngày là Invalid Date.
 */
export function localDateTime(date: string | null | undefined, time?: string | null): Date {
  if (!date) return new Date(Number.NaN);
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = (time ?? '00:00').split(':').map(Number);
  return new Date(year, month - 1, day, hour || 0, minute || 0);
}

export function valid(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function dayLabel(value: Date, now: Date): string {
  const days = Math.round((startOfDay(value).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Ngày mai';
  const weekday = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][value.getDay()];
  return `${weekday}, ${String(value.getDate()).padStart(2, '0')}/${String(value.getMonth() + 1).padStart(2, '0')}`;
}

export function hhmm(value: Date): string {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

export function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 4) return 'Chào buổi tối';
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 14) return 'Chào buổi trưa';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

/** Bên của người xem trong kèo: chính họ, thành viên đội, hoặc quản lý CLB. */
export function mySide(session: MatchmakingSessionModel, userId: string): MatchmakingPlayer | undefined {
  return session.participants.find(side => side.participantId === userId
    || side.members?.some(member => member.userId === userId)
    || side.managerIds?.includes(userId));
}

function opponentName(session: MatchmakingSessionModel, userId: string): string {
  const mine = mySide(session, userId);
  return session.participants.find(side => side !== mine)?.name ?? 'đối thủ';
}

export function buildAgenda(input: {
  now: Date;
  userId: string;
  bookings: Booking[];
  session: MatchmakingSessionModel | null;
  activities: ClubActivityModel[];
  clubNames: ReadonlyMap<string, string>;
  tournaments: TournamentModel[];
}, limit = 6): AgendaItem[] {
  const { now, userId, session } = input;
  const items: AgendaItem[] = [];
  const sessionActive = session && ACTIVE_SESSION.has(session.status);

  if (sessionActive) {
    items.push({
      id: `match-${session.sessionId}`,
      kind: 'MATCH',
      title: `Kèo ${sportLabel(session.sportType).toLowerCase()} với ${opponentName(session, userId)}`,
      subtitle: 'AI ghép trận',
      start: localDateTime(session.playDate, session.startTime),
      end: localDateTime(session.playDate, session.endTime),
      allDay: false,
      status: SESSION_STATUS[session.status],
      link: ['/matchmaking']
    });
  }

  for (const booking of input.bookings) {
    // Đơn đặt sân của kèo AI đã nằm trong dòng kèo phía trên.
    if (!UPCOMING_BOOKING.has(booking.status) || (sessionActive && session.proposal?.bookingId === booking.bookingId)) continue;
    items.push({
      id: `booking-${booking.bookingId}`,
      kind: 'BOOKING',
      title: booking.venueName ?? 'Đặt sân',
      subtitle: [booking.courtName, `Mã ${booking.bookingCode}`].filter(Boolean).join(' · '),
      start: localDateTime(booking.playDate, booking.startTime),
      end: localDateTime(booking.playDate, booking.endTime),
      allDay: false,
      status: { label: BOOKING_STATUS_LABELS[booking.status], tone: BOOKING_TONE[booking.status] ?? 'neutral' },
      link: ['/booking/detail', booking.bookingId]
    });
  }

  for (const activity of input.activities) {
    items.push({
      id: `club-${activity.activityId}`,
      kind: 'CLUB',
      title: activity.title,
      subtitle: input.clubNames.get(activity.clubId) ?? 'Hoạt động CLB',
      start: new Date(activity.startAt),
      end: new Date(activity.endAt),
      allDay: false,
      link: ['/clubs/my', activity.clubId]
    });
  }

  for (const tournament of input.tournaments) {
    if (!['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS'].includes(tournament.status)) continue;
    items.push({
      id: `tournament-${tournament.tournamentId}`,
      kind: 'TOURNAMENT',
      title: tournament.name,
      subtitle: `Giải ${sportLabel(tournament.sportType).toLowerCase()}`,
      start: localDateTime(tournament.startDate, tournament.dailyStartTime),
      end: localDateTime(tournament.endDate, '23:59'),
      allDay: !tournament.dailyStartTime,
      status: tournament.status === 'IN_PROGRESS' ? { label: 'Đang diễn ra', tone: 'success' } : undefined,
      link: ['/tournaments', tournament.tournamentId]
    });
  }

  return items
    .filter(item => valid(item.start) && valid(item.end) && item.end.getTime() >= now.getTime())
    .sort((left, right) => left.start.getTime() - right.start.getTime())
    .slice(0, limit);
}

export function buildTasks(input: {
  now: Date;
  userId: string;
  bookings: Booking[];
  session: MatchmakingSessionModel | null;
  clubInvitations: ClubInvitationModel[];
  teamInvitations: TeamInvitationModel[];
  friendRequests: number;
}): TaskItem[] {
  const { now, userId, session } = input;
  const tasks: TaskItem[] = [];

  if (session && ACTIVE_SESSION.has(session.status)) {
    const mine = mySide(session, userId);
    const sport = sportLabel(session.sportType).toLowerCase();
    const opponent = opponentName(session, userId);
    const booker = session.proposal?.designatedBookerId === userId;
    const ended = localDateTime(session.playDate, session.endTime).getTime() <= now.getTime();
    const sideUsers = new Set([mine?.participantId, ...(mine?.members ?? []).map(member => member.userId),
      ...(mine?.managerIds ?? [])]);
    const base = { link: ['/matchmaking'] };

    if (['PROPOSED', 'ACCEPTED_BY_ONE'].includes(session.status)
      && mine && !session.acceptances.some(item => item.participantProfileId === mine.participantProfileId)) {
      tasks.push({ ...base, id: 'match-decide', icon: 'hourglass', tone: 'warning',
        title: 'Đối thủ đang chờ bạn phản hồi', detail: `Kèo ${sport} với ${opponent}`,
        deadline: new Date(session.expiresAt) });
    } else if (session.status === 'ACCEPTED' && booker) {
      tasks.push({ ...base, id: 'match-venue', icon: 'map-pin', tone: 'info',
        title: 'Chọn sân cho kèo', detail: `Hai bên đã đồng ý kèo ${sport} với ${opponent}` });
    } else if (['VENUE_SELECTED', 'BOOKING_PENDING'].includes(session.status) && booker) {
      tasks.push({ ...base, id: 'match-book', icon: 'wallet', tone: 'warning',
        title: 'Đặt sân và thanh toán cọc', detail: `Kèo ${sport} với ${opponent}` });
    } else if ((session.status === 'CHECKED_IN' && ended) || session.status === 'RESULT_PENDING' || session.status === 'DISPUTED') {
      const submitted = session.resultClaims.some(claim => sideUsers.has(claim.submittedBy));
      if (session.status === 'DISPUTED' || !submitted) {
        tasks.push({ ...base, id: 'match-result', icon: 'target', tone: session.status === 'DISPUTED' ? 'danger' : 'warning',
          title: session.status === 'DISPUTED' ? 'Tỷ số hai bên chưa khớp' : 'Nhập tỷ số trận vừa đấu',
          detail: `Kèo ${sport} với ${opponent}`,
          deadline: session.resultDeadlineAt ? new Date(session.resultDeadlineAt) : undefined });
      }
    }
  }

  for (const booking of input.bookings) {
    if (booking.status !== BookingStatus.PENDING_PAYMENT) continue;
    const hold = booking.holdExpiresAt ? new Date(booking.holdExpiresAt) : undefined;
    if (hold && hold.getTime() <= now.getTime()) continue;
    tasks.push({ id: `pay-${booking.bookingId}`, icon: 'wallet', tone: 'warning',
      title: 'Thanh toán cọc để giữ sân',
      detail: [booking.venueName ?? 'Sân', valid(localDateTime(booking.playDate))
        ? `${dayLabel(localDateTime(booking.playDate), now)} ${booking.startTime?.slice(0, 5) ?? ''}`.trim() : null]
        .filter(Boolean).join(' · '),
      deadline: hold, link: ['/booking/detail', booking.bookingId] });
  }

  for (const invitation of input.clubInvitations) {
    if (invitation.status !== 'PENDING') continue;
    tasks.push({ id: `club-invite-${invitation.invitationId}`, icon: 'mail', tone: 'info',
      title: `Lời mời vào CLB ${invitation.club.name}`, detail: sportLabel(invitation.club.sportType),
      link: ['/clubs/my'] });
  }

  for (const invitation of input.teamInvitations) {
    tasks.push({ id: `team-invite-${invitation.registrationId}`, icon: 'trophy', tone: 'info',
      title: `Lời mời thi đấu ${invitation.tournamentName}`,
      detail: `${invitation.teamName ?? 'Đội'} · ${invitation.acceptedCount}/${invitation.rosterMin} người đã nhận`,
      link: ['/tournaments', invitation.tournamentId] });
  }

  if (input.friendRequests > 0) {
    tasks.push({ id: 'friend-requests', icon: 'user-plus', tone: 'info',
      title: `${input.friendRequests} lời mời kết bạn`, detail: 'Xem và phản hồi trong Cộng đồng',
      link: ['/feed'], queryParams: { tab: 'friends' } });
  }

  return tasks.sort((left, right) =>
    (left.deadline?.getTime() ?? Infinity) - (right.deadline?.getTime() ?? Infinity));
}

/** Sân đã chơi, xếp theo lần chơi gần nhất, để đặt lại nhanh. */
export function frequentVenues(bookings: Booking[], now: Date, limit = 4): FrequentVenue[] {
  const byVenue = new Map<string, FrequentVenue>();
  for (const booking of bookings) {
    if (!booking.venueId || !PLAYED_BOOKING.has(booking.status)) continue;
    const played = localDateTime(booking.playDate, booking.startTime);
    if (!valid(played) || played.getTime() > now.getTime()) continue; // đơn sắp tới chưa phải "đã chơi"
    const current = byVenue.get(booking.venueId);
    if (!current) {
      byVenue.set(booking.venueId, { venueId: booking.venueId, venueName: booking.venueName ?? 'Sân',
        courtName: booking.courtName, visits: 1, lastPlayed: played });
      continue;
    }
    current.visits += 1;
    if (played > current.lastPlayed) {
      current.lastPlayed = played;
      current.courtName = booking.courtName;
    }
  }
  return [...byVenue.values()].sort((left, right) => right.lastPlayed.getTime() - left.lastPlayed.getTime()).slice(0, limit);
}
