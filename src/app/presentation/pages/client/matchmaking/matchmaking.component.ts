import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  NgZone,
  OnInit,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable, Subscription, catchError, finalize, forkJoin, map, of, switchMap, timer } from 'rxjs';
import gsap from 'gsap';
import { AiRepositoryPort } from '@application/ports/ai.repository.port';
import {
  AcceptanceDecision,
  JoinMatchmakingQueueRequest,
  MatchCandidate,
  MatchmakingPlayer,
  MatchResultClaim,
  MatchSelectionMode,
  MatchmakingSession,
  MatchmakingSkill,
  MatchmakingSport,
  MatchSessionStatus
} from '@application/dto/matchmaking/matchmaking.dto';
import {
  PlayerAvailability,
  PlayerDayOfWeek,
  PlayerSportProfile
} from '@application/dto/player-sport-profile/player-sport-profile.dto';
import {
  PLAYER_SPORT_PROFILE_REPOSITORY_TOKEN,
  PlayerSportProfileRepository
} from '@application/ports/persistence/player-sport-profile.repository';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { FRIEND_REPOSITORY_TOKEN } from '@application/ports/persistence/friend.repository';
import { MyClubMembership } from '@application/dto/club/club.dto';
import { PlayerDirectoryService } from '@presentation/services/player-directory.service';
import { PLAY_FORMATS } from '@domain/models/matchmaking.model';
import { SelectOption } from '@shared/components/ui/select/select.component';
import { AuthService } from '@presentation/services/auth.service';
import { NotificationService } from '@presentation/services/notification.service';
import { NotificationType } from '@application/dto/notification/notification.dto';

type MatchmakingPlayStyle = 'BALANCED' | 'FAIR_PLAY' | 'COMPETITIVE';
type Coordinates = { latitude: number; longitude: number; source: 'profile' | 'browser' };
type ScheduleConflict = { session: MatchmakingSession; bufferedStart: Date; bufferedEnd: Date };

/** Nguồn đồng đội: thành viên một CLB mình đang ở, bạn bè, đại diện cả CLB (chủ/quản lý), hoặc đăng tìm người. */
type TeamSource = 'CLUB_MEMBERS' | 'FRIENDS' | 'CLUB_SIDE' | 'CALL';
type SetupStep = 'SPORT' | 'TEAM' | 'TIME' | 'PREFS';
type PartnerOption = { userId: string; fullName: string };
/** clubId: chọn từ danh sách thành viên CLB đó (server kiểm tra cùng CLB); null: chọn từ bạn bè. */
type Teammate = PartnerOption & { clubId: string | null };

const STEP_LABELS: Record<SetupStep, string> = {
  SPORT: 'Môn & hình thức',
  TEAM: 'Đồng đội',
  TIME: 'Thời gian & nơi chơi',
  PREFS: 'Tiêu chí ghép'
};

const DAY_INDEX: Record<PlayerDayOfWeek, number> = {
  [PlayerDayOfWeek.SUNDAY]: 0,
  [PlayerDayOfWeek.MONDAY]: 1,
  [PlayerDayOfWeek.TUESDAY]: 2,
  [PlayerDayOfWeek.WEDNESDAY]: 3,
  [PlayerDayOfWeek.THURSDAY]: 4,
  [PlayerDayOfWeek.FRIDAY]: 5,
  [PlayerDayOfWeek.SATURDAY]: 6
};

@Component({
  selector: 'app-matchmaking',
  templateUrl: './matchmaking.component.html',
  styleUrls: ['./matchmaking.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class MatchmakingComponent implements OnInit, AfterViewInit {
  private readonly aiRepository = inject(AiRepositoryPort);
  private readonly profileRepository = inject<PlayerSportProfileRepository>(
    PLAYER_SPORT_PROFILE_REPOSITORY_TOKEN
  );
  private readonly authService = inject(AuthService);
  private readonly clubRepository = inject(ClubRepositoryPort);
  private readonly friendRepository = inject(FRIEND_REPOSITORY_TOKEN);
  private readonly directory = inject(PlayerDirectoryService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly injector = inject(Injector);
  private animationContext?: ReturnType<typeof gsap.context>;
  readonly historySentinel = viewChild<ElementRef<HTMLElement>>('historySentinel');
  readonly historyScrollContainer = viewChild<ElementRef<HTMLElement>>('historyScrollContainer');
  private historyObserver: IntersectionObserver | null = null;

  readonly selectedSport = signal<MatchmakingSport>('BADMINTON');
  readonly playFormat = signal('BADMINTON_SINGLES');
  /** CLB mình đại diện khi đấu CLB đấu CLB. */
  readonly clubId = signal<string | null>(null);
  readonly friends = signal<PartnerOption[] | null>(null);
  readonly friendsLoading = signal(false);
  readonly clubMemberships = signal<MyClubMembership[] | null>(null);
  readonly clubsLoading = signal(false);
  readonly teamSource = signal<TeamSource>('FRIENDS');
  /** Đã tự chọn nguồn đồng đội thì không tự đổi sang "Thành viên CLB" khi danh sách CLB tải xong. */
  private teamSourceTouched = false;
  readonly memberClubId = signal<string | null>(null);
  readonly clubMembers = signal<Record<string, PartnerOption[]>>({});
  readonly membersLoading = signal(false);
  readonly teammates = signal<Teammate[]>([]);
  readonly teammateQuery = signal('');
  readonly step = signal<SetupStep>('SPORT');
  readonly formats = computed(() => PLAY_FORMATS[this.selectedSport()]);
  readonly formatLabel = computed(() => this.formats().find(item => item.value === this.playFormat())?.label ?? '');
  /** Số người mỗi bên của hình thức đang chọn (đơn: 1, đôi: 2, sân 5: 5...). */
  readonly teamSize = computed(() => this.formats().find(item => item.value === this.playFormat())?.size ?? 1);
  readonly neededTeammates = computed(() => this.teamSize() - 1);
  /** CLB cùng môn mình đang là thành viên: nguồn đồng đội cho mọi môn, kể cả đánh đôi. */
  readonly sportClubs = computed(() => (this.clubMemberships() ?? []).filter(item =>
    item.status === 'ACTIVE' && item.club.sportType === this.selectedSport() && item.club.active !== false));
  /** Chỉ môn đồng đội: CLB mình là chủ hoặc quản lý thì được đại diện cả CLB đấu CLB. */
  readonly managedClubs = computed(() => this.teamSize() > 2
    ? this.sportClubs().filter(item => item.role === 'OWNER' || item.role === 'ADMIN')
    : []);
  readonly representsClub = computed(() => this.teamSize() > 2 && this.teamSource() === 'CLUB_SIDE');
  readonly memberClubOptions = computed<SelectOption[]>(() =>
    this.sportClubs().map(item => ({ value: item.club.clubId, label: item.club.name })));
  readonly clubOptions = computed<SelectOption[]>(() =>
    this.managedClubs().map(item => ({ value: item.club.clubId, label: item.club.name })));
  readonly teamSources = computed<ReadonlyArray<{ value: TeamSource; label: string; icon: string }>>(() => [
    { value: 'CLUB_MEMBERS', label: 'Thành viên CLB', icon: 'users-round' },
    { value: 'FRIENDS', label: 'Bạn bè', icon: 'user-plus' },
    ...(this.managedClubs().length ? [{ value: 'CLUB_SIDE' as const, label: 'Đại diện CLB', icon: 'shield' }] : []),
    { value: 'CALL', label: 'Đăng tìm người', icon: 'megaphone' }
  ]);
  readonly representedClubName = computed(() => this.clubOptions().find(item => item.value === this.clubId())?.label ?? '');
  readonly currentUserName = computed(() => {
    const user = this.authService.currentUser;
    return user?.fullName || user?.username || 'Bạn';
  });
  readonly teammateIds = computed(() => new Set(this.teammates().map(item => item.userId)));
  readonly teamFull = computed(() => this.teammates().length >= this.neededTeammates());
  /** Người có thể chọn ở nguồn hiện tại, lọc theo ô tìm; không có chính mình. */
  readonly pool = computed<PartnerOption[]>(() => {
    const me = this.authService.currentUser?.userId;
    const source = this.teamSource();
    const list = source === 'FRIENDS' ? this.friends() ?? []
      : source === 'CLUB_MEMBERS' ? this.clubMembers()[this.memberClubId() ?? ''] ?? [] : [];
    const query = this.fold(this.teammateQuery());
    return list.filter(item => item.userId !== me && (!query || this.fold(item.fullName).includes(query)));
  });
  /** Chỗ trống còn lại trong đội (chỉ để vẽ ô trống). */
  readonly openSlots = computed(() =>
    Array.from({ length: Math.max(0, this.neededTeammates() - this.teammates().length) }, (_, index) => index));
  readonly teamReady = computed(() => this.teamSize() === 1
    || (this.representsClub() ? !!this.clubId() : this.teammates().length === this.neededTeammates()));
  readonly steps = computed(() => {
    const keys: SetupStep[] = this.teamSize() > 1 ? ['SPORT', 'TEAM', 'TIME', 'PREFS'] : ['SPORT', 'TIME', 'PREFS'];
    return keys.map(key => ({ key, label: STEP_LABELS[key], summary: this.stepSummary(key) }));
  });
  readonly stepIndex = computed(() => Math.max(0, this.steps().findIndex(item => item.key === this.step())));
  readonly isLastStep = computed(() => this.stepIndex() === this.steps().length - 1);
  /** Trình độ, ELO, phong cách, cách chọn: đã có mặc định từ hồ sơ nên thu gọn, chỉ hiện một dòng tóm tắt. */
  readonly prefsOpen = signal(false);
  readonly prefsSummary = computed(() => [
    this.skills.find(item => item.value === this.selectedSkill())?.label,
    `ELO ${this.eloRating()} ±${this.maxEloDifference()}`,
    this.playStyles.find(item => item.value === this.selectedPlayStyle())?.label,
    this.selectionMode() === 'AI' ? 'AI tự chọn' : 'Tôi sẽ chọn'
  ].filter(Boolean).join(' · '));
  readonly criteria: ReadonlyArray<{ icon: string; label: string; helper: string; weight: number }> = [
    { icon: 'trending-up', label: 'ELO theo môn', helper: 'Điểm thi đấu trong đúng môn', weight: 30 },
    { icon: 'clock-3', label: 'Khung giờ', helper: 'Phần rảnh chung của hai bên', weight: 25 },
    { icon: 'map-pin', label: 'Khoảng cách', helper: 'Ưu tiên đối thủ gần bạn', weight: 15 },
    { icon: 'badge-check', label: 'Trình độ', helper: 'Mức kỹ năng trong hồ sơ', weight: 10 },
    { icon: 'users', label: 'Phong cách', helper: 'Cùng tinh thần thể thao', weight: 10 },
    { icon: 'scan-search', label: 'Vị trí yêu thích', helper: 'Vai trò hoặc vị trí thi đấu', weight: 5 },
    { icon: 'history', label: 'Kinh nghiệm', helper: 'Số trận và tỷ lệ thắng', weight: 5 }
  ];
  readonly selectedSkill = signal<MatchmakingSkill>('INTERMEDIATE');
  readonly selectedPlayStyle = signal<MatchmakingPlayStyle>('BALANCED');
  readonly selectionMode = signal<MatchSelectionMode>('AI');
  readonly eloRating = signal(1200);
  readonly maxEloDifference = signal(300);
  readonly maxDistance = signal(10);
  readonly playDate = signal(this.localDate(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  readonly startTime = signal('18:00');
  readonly endTime = signal('20:00');
  readonly timezone = signal('Asia/Ho_Chi_Minh');
  readonly coordinates = signal<Coordinates | null>(null);
  readonly profiles = signal<PlayerSportProfile[]>([]);
  readonly history = signal<MatchmakingSession[]>([]);
  readonly candidates = signal<MatchCandidate[]>([]);
  readonly locating = signal(false);
  readonly isSearching = signal(false);
  readonly restoring = signal(true);
  readonly responding = signal(false);
  readonly actionLoading = signal(false);
  readonly resultMyScore = signal(0);
  readonly resultOpponentScore = signal(0);
  readonly feedbackRating = signal(5);
  readonly fairPlayRating = signal(5);
  readonly feedbackComment = signal('');
  readonly historyLoading = signal(true);
  readonly historyLoadingMore = signal(false);
  readonly historyHasMore = signal(true);
  private static readonly HISTORY_PAGE_SIZE = 5;
  readonly elapsedSeconds = signal(0);
  readonly nowMs = signal(Date.now());
  readonly queueSize = signal<number | null>(null);
  readonly session = signal<MatchmakingSession | null>(null);
  readonly selectedHistorySession = signal<MatchmakingSession | null>(null);
  readonly errorMessage = signal('');
  readonly historyError = signal('');

  readonly today = this.localDate(new Date());
  readonly sports: ReadonlyArray<{ label: string; value: MatchmakingSport; icon: string }> = [
    { label: 'Cầu lông', value: 'BADMINTON', icon: 'activity' },
    { label: 'Pickleball', value: 'PICKLEBALL', icon: 'circle-dot' },
    { label: 'Tennis', value: 'TENNIS', icon: 'circle' },
    { label: 'Bóng đá', value: 'FOOTBALL', icon: 'circle-dot' },
    { label: 'Bóng rổ', value: 'BASKETBALL', icon: 'circle-dot-dashed' },
    { label: 'Bóng chuyền', value: 'VOLLEYBALL', icon: 'circle-dot' }
  ];
  readonly sportOptions: readonly SelectOption[] = this.sports.map(item => ({
    value: item.value, label: item.label, icon: item.icon
  }));
  readonly formatOptions = computed<SelectOption[]>(() =>
    this.formats().map(item => ({ value: item.value, label: `${item.label} · ${item.helper}` })));
  readonly sportIcon = computed(() => this.sports.find(item => item.value === this.selectedSport())?.icon ?? 'trophy');
  /** Kèo đang mở hộp thoại đánh giá đối thủ (chỉ mở khi bấm nút). */
  readonly feedbackTarget = signal<MatchmakingSession | null>(null);
  readonly ratingScale = [1, 2, 3, 4, 5] as const;
  readonly skills: ReadonlyArray<{
    label: string;
    helper: string;
    value: MatchmakingSkill;
    suggestedElo: number;
  }> = [
    { label: 'Mới chơi', helper: 'Dưới 6 tháng', value: 'BEGINNER', suggestedElo: 1000 },
    { label: 'Trung bình', helper: '6 tháng – 2 năm', value: 'INTERMEDIATE', suggestedElo: 1200 },
    { label: 'Khá', helper: '2 – 5 năm', value: 'ADVANCED', suggestedElo: 1500 },
    { label: 'Nâng cao', helper: 'Trên 5 năm', value: 'PRO', suggestedElo: 1800 }
  ];
  readonly playStyles: ReadonlyArray<{
    label: string;
    helper: string;
    value: MatchmakingPlayStyle;
  }> = [
    { label: 'Cân bằng', helper: 'Vui và cạnh tranh vừa đủ', value: 'BALANCED' },
    { label: 'Fair-play', helper: 'Ưu tiên tinh thần thể thao', value: 'FAIR_PLAY' },
    { label: 'Cạnh tranh', helper: 'Thi đấu nghiêm túc', value: 'COMPETITIVE' }
  ];

  readonly hideRestoredSession = signal(false);
  /** Hàng trên: chỉ kèo vừa tìm thấy (hoặc được cập nhật realtime). Kèo khôi phục khi mở trang chỉ nằm trong lịch sử. */
  readonly liveSession = computed(() => this.hideRestoredSession() ? null : this.session());
  readonly selectedSportLabel = computed(() =>
    this.sports.find(item => item.value === this.selectedSport())?.label ?? this.selectedSport()
  );
  readonly selectedPlayDateLabel = computed(() => this.formatLocalDate(this.playDate()));
  readonly activeProfile = computed(() =>
    this.profiles().find(item => item.sportType === this.selectedSport()) ?? null
  );

  // ---- Thông tin của một phiên. Nhận phiên làm tham số vì hàng trên (kèo đang tìm thấy) và cột trái
  // (kèo chọn từ lịch sử) có thể cùng hiện hai phiên khác nhau. ----

  /** Phiên không phải kèo hiện tại: chỉ xem, không thao tác. */
  isHistory(m: MatchmakingSession): boolean {
    return m.sessionId !== this.session()?.sessionId;
  }

  /** Bên của mình: chính mình, cặp / đội có mình, hoặc CLB mình là chủ/quản lý. */
  currentParticipant(m: MatchmakingSession): MatchmakingPlayer | null {
    return this.mySide(m);
  }

  opponent(m: MatchmakingSession): MatchmakingPlayer | null {
    const mine = this.currentParticipant(m);
    return m.participants.find(item => item !== mine) ?? null;
  }

  matchDateLabel(m: MatchmakingSession): string {
    return m.playDate ? this.formatLocalDate(m.playDate) : '';
  }

  responseRemainingSeconds(m: MatchmakingSession): number {
    if (!m.expiresAt) return 0;
    return Math.max(0, Math.ceil((new Date(m.expiresAt).getTime() - this.nowMs()) / 1000));
  }

  myDecision(m: MatchmakingSession): AcceptanceDecision | null {
    const profileId = this.currentParticipant(m)?.participantProfileId;
    return m.acceptances.find(item => item.participantProfileId === profileId)?.decision ?? null;
  }

  canRespond(m: MatchmakingSession): boolean {
    if (this.isHistory(m)) return false;
    return !this.myDecision(m) && (m.status === 'PROPOSED' || m.status === 'ACCEPTED_BY_ONE')
      && this.responseRemainingSeconds(m) > 0;
  }

  canOpenChat(m: MatchmakingSession): boolean {
    return Boolean(m.proposal?.conversationId);
  }

  isDesignatedBooker(m: MatchmakingSession): boolean {
    return m.proposal?.designatedBookerId === this.authService.currentUser?.userId;
  }

  isTerminalMatchStatus(m: MatchmakingSession): boolean {
    return m.status === 'REJECTED' || m.status === 'EXPIRED' || m.status === 'CANCELLED';
  }

  statusMessage(m: MatchmakingSession): string {
    const status = m.status;
    if (status === 'ACCEPTED') return 'Hai bên đã xác nhận kèo';
    if (status === 'VENUE_SELECTED') return 'Đã chọn sân, chờ người đặt cọc';
    if (status === 'BOOKING_PENDING') return 'Đang chờ thanh toán tiền cọc';
    if (status === 'CONFIRMED') return 'Trận đấu đã được xác nhận';
    if (status === 'CHECKED_IN') {
      return this.canEnterResult(m)
        ? 'Hai người chơi có thể nhập kết quả'
        : 'Đã check-in · trận đấu đang diễn ra';
    }
    if (status === 'RESULT_PENDING') return 'Đang chờ đối thủ xác nhận kết quả';
    if (status === 'DISPUTED') return 'Kết quả chưa trùng khớp';
    if (status === 'COMPLETED') return 'Trận đấu đã hoàn tất';
    if (status === 'ACCEPTED_BY_ONE') return this.myDecision(m) === 'ACCEPTED'
      ? 'Đang chờ đối thủ xác nhận'
      : 'Đối thủ đã đồng ý, đến lượt bạn';
    if (status === 'REJECTED') return 'Kèo đã bị từ chối';
    if (status === 'EXPIRED') {
      if (m.proposal?.cancelReason === 'NO_CHECK_IN') return 'Không ai check-in nhận sân nên trận không được ghi nhận';
      if (m.proposal?.cancelReason === 'NOT_BOOKED') return 'Đã qua giờ chơi mà chưa đặt được sân nên kèo đã đóng';
      return 'Kèo đã hết thời gian xác nhận';
    }
    if (status === 'CANCELLED') return this.cancelReasonMessage(m);
    return 'Đã tìm thấy đối thủ';
  }

  cancelReasonMessage(m: MatchmakingSession): string {
    switch (m.proposal?.cancelReason) {
      case 'PLAYER_CANCELLED':
        return this.isDesignatedBooker(m)
          ? 'Bạn đã hủy đặt sân cho kèo này'
          : 'Người đặt cọc đã hủy đặt sân cho kèo này';
      case 'PAYMENT_EXPIRED':
        return 'Đã hết thời gian thanh toán tiền cọc';
      case 'PAYMENT_CANCELLED':
        return 'Thanh toán tiền cọc đã bị hủy';
      case 'REFUNDED':
        return 'Đặt sân đã bị hủy, tiền cọc đã được hoàn lại';
      default:
        return 'Kèo đã bị hủy';
    }
  }

  statusLabel(m: MatchmakingSession): string {
    return this.sessionStatusLabel(m.status);
  }

  checkInWindowState(m: MatchmakingSession): 'BEFORE' | 'ACTIVE' | 'MISSED' | null {
    if (m.status !== 'CONFIRMED') return null;
    const start = this.localDateTime(m.playDate, m.startTime);
    const end = this.localDateTime(m.playDate, m.endTime);
    if (!start || !end) return null;
    const now = this.nowMs();
    if (now < start.getTime()) return 'BEFORE';
    if (now <= end.getTime()) return 'ACTIVE';
    return 'MISSED';
  }

  checkInWindowLabel(m: MatchmakingSession): string {
    const state = this.checkInWindowState(m);
    if (state === 'BEFORE') {
      const start = this.localDateTime(m.playDate, m.startTime);
      if (start) {
        const hoursLeft = Math.ceil((start.getTime() - this.nowMs()) / 3_600_000);
        return hoursLeft > 0
          ? `Còn khoảng ${hoursLeft} giờ nữa · mang mã QR tới sân để check-in`
          : 'Sắp tới giờ chơi · mang mã QR tới sân để check-in';
      }
    }
    if (state === 'ACTIVE') return 'Đang trong khung giờ chơi · chưa check-in tại sân';
    if (state === 'MISSED') return 'Chưa check-in tại sân · trận sẽ không được ghi nhận kết quả';
    return '';
  }

  canEnterResult(m: MatchmakingSession): boolean {
    const end = this.localDateTime(m.playDate, m.endTime);
    return Boolean(end && this.nowMs() >= end.getTime());
  }

  matchInProgressLabel(m: MatchmakingSession): string {
    const start = this.localDateTime(m.playDate, m.startTime);
    const endLabel = (m.endTime ?? '').slice(0, 5);
    return start && this.nowMs() < start.getTime()
      ? `Trận chưa bắt đầu · chỉ nhập được kết quả sau ${endLabel}`
      : `Trận đang diễn ra · chỉ nhập được kết quả sau ${endLabel}`;
  }

  resultDeadlineState(m: MatchmakingSession): 'OPEN' | 'WAITING_OPPONENT' | null {
    if (!m.resultDeadlineAt) return null;
    if (m.status !== 'CHECKED_IN' && m.status !== 'RESULT_PENDING' && m.status !== 'DISPUTED') return null;
    return this.hasSubmittedResult(m) ? 'WAITING_OPPONENT' : 'OPEN';
  }

  resultDeadlineLabel(m: MatchmakingSession): string {
    const state = this.resultDeadlineState(m);
    if (!state || !m.resultDeadlineAt) return '';
    const remaining = new Date(m.resultDeadlineAt).getTime() - this.nowMs();
    const countdown = remaining <= 0
      ? 'Đã hết hạn nhập kết quả'
      : remaining < 3_600_000
        ? `Còn ${Math.max(1, Math.ceil(remaining / 60_000))} phút để nhập kết quả`
        : `Còn ${Math.ceil(remaining / 3_600_000)} giờ để nhập kết quả`;
    return state === 'WAITING_OPPONENT'
      ? `${countdown} · đang chờ đối thủ nhập. Quá hạn, bạn được xử thắng`
      : `${countdown}. Quá hạn mà bạn không nhập, đối thủ được xử thắng; cả hai không nhập thì tính hòa`;
  }

  progressPercent(m: MatchmakingSession): string {
    return `${this.matchProgressStep(m.status) * 20}%`;
  }
  readonly scheduleConflict = computed<ScheduleConflict | null>(() => {
    const requestStart = this.localDateTime(this.playDate(), this.startTime());
    const requestEnd = this.localDateTime(this.playDate(), this.endTime());
    if (!requestStart || !requestEnd || requestEnd <= requestStart) return null;

    const now = Date.now();
    const sessions = this.uniqueSessions([this.session(), ...this.history()]);
    for (const match of sessions) {
      if (!['CONFIRMED', 'CHECKED_IN', 'RESULT_PENDING', 'DISPUTED'].includes(match.status)) continue;
      const matchStart = this.localDateTime(match.playDate, match.startTime);
      const matchEnd = this.localDateTime(match.playDate, match.endTime);
      if (!matchStart || !matchEnd) continue;
      const bufferedStart = new Date(matchStart.getTime() - 60 * 60 * 1000);
      const bufferedEnd = new Date(matchEnd.getTime() + 60 * 60 * 1000);
      if (bufferedEnd.getTime() <= now) continue;
      if (requestStart < bufferedEnd && requestEnd > bufferedStart) {
        return { session: match, bufferedStart, bufferedEnd };
      }
    }
    return null;
  });
  readonly hasUpcomingMatch = computed(() => this.uniqueSessions([this.session(), ...this.history()]).some(match => {
    if (!['CONFIRMED', 'CHECKED_IN', 'RESULT_PENDING', 'DISPUTED'].includes(match.status)) return false;
    const end = this.localDateTime(match.playDate, match.endTime);
    return Boolean(end && end.getTime() + 60 * 60 * 1000 > this.nowMs());
  }));
  readonly searchButtonLabel = computed(() => this.hasUpcomingMatch() ? 'Tìm đối thủ khác' : 'Tìm đối thủ');

  private elapsedTimer?: Subscription;
  private sessionExpiryRefresh?: Subscription;
  private realtimeRefreshInFlight = false;
  private realtimeRefreshPending = false;

  ngOnInit(): void {
    timer(0, 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.nowMs.set(Date.now()));

    this.notificationService.realtimeNotifications$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(notification => {
        if (notification.type !== NotificationType.MATCHMAKING
          || (notification.referenceType || '').toUpperCase() !== 'MATCHMAKING_SESSION') {
          return;
        }
        this.refreshFromRealtimeEvent(notification.referenceId);
      });

    if (!this.authService.currentUser) {
      this.restoring.set(false);
      this.historyLoading.set(false);
      return;
    }

    forkJoin({
      profiles: this.profileRepository.getMyProfiles().pipe(
        catchError(() => of([] as PlayerSportProfile[]))
      ),
      history: this.aiRepository.getMatchmakingHistory(MatchmakingComponent.HISTORY_PAGE_SIZE, 0).pipe(
        catchError(() => of([] as MatchmakingSession[]))
      )
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ profiles, history }) => {
        this.profiles.set(Array.isArray(profiles) ? profiles : []);
        const items = Array.isArray(history) ? history : [];
        this.history.set(items);
        this.historyHasMore.set(items.length >= MatchmakingComponent.HISTORY_PAGE_SIZE);
        this.historyLoading.set(false);
        this.applyProfileForSport(this.selectedSport());
      },
      error: () => {
        this.historyLoading.set(false);
        this.historyError.set('Chưa thể tải lịch sử ghép kèo.');
      }
    });
    this.restoreState();
    this.loadClubs();
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.setupHistoryInfiniteScroll();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.animationContext = gsap.context(() => {
        gsap.from('.matchmaking-hero', {
          autoAlpha: 0,
          y: 18,
          duration: 0.55,
          ease: 'power3.out'
        });
        gsap.from('.stage, .insights > *', {
          autoAlpha: 0,
          y: 22,
          duration: 0.62,
          stagger: 0.08,
          delay: 0.08,
          ease: 'power3.out'
        });
      }, this.host.nativeElement);
    });
    this.destroyRef.onDestroy(() => this.animationContext?.revert());
  }

  private setupHistoryInfiniteScroll(): void {
    effect(() => {
      const sentinel = this.historySentinel();
      const container = this.historyScrollContainer();
      this.historyObserver?.disconnect();
      this.historyObserver = null;
      if (!sentinel) return;
      const observer = new IntersectionObserver(
        entries => {
          if (entries[0]?.isIntersecting) {
            this.zone.run(() => this.loadMoreHistory());
          }
        },
        { root: container?.nativeElement ?? null, rootMargin: '100px' }
      );
      observer.observe(sentinel.nativeElement);
      this.historyObserver = observer;
    }, { injector: this.injector });
    this.destroyRef.onDestroy(() => this.historyObserver?.disconnect());
  }

  selectSport(sport: MatchmakingSport): void {
    if (sport !== this.selectedSport()) {
      this.teammates.set([]);
      this.memberClubId.set(null);
      this.teamSourceTouched = false;
    }
    this.selectedSport.set(sport);
    this.applyProfileForSport(sport);
    this.selectFormat(PLAY_FORMATS[sport][0].value);
  }

  selectFormat(format: string): void {
    this.playFormat.set(format);
    this.errorMessage.set('');
    // Đổi sang hình thức ít người hơn: giữ những người chọn trước, bỏ phần thừa.
    this.teammates.update(items => items.slice(0, this.neededTeammates()));
    if (this.teamSize() > 1) {
      this.loadFriends();
      this.loadClubs();
    }
    this.syncTeamDefaults();
  }

  /** Mặc định: đang ở CLB cùng môn thì chọn đồng đội trong CLB trước, không thì bạn bè. */
  private syncTeamDefaults(): void {
    const clubs = this.sportClubs();
    if (!clubs.some(item => item.club.clubId === this.memberClubId())) {
      this.memberClubId.set(clubs[0]?.club.clubId ?? null);
    }
    const managed = this.managedClubs();
    if (!managed.some(item => item.club.clubId === this.clubId())) this.clubId.set(managed[0]?.club.clubId ?? null);
    if (this.teamSource() === 'CLUB_SIDE' && !managed.length) this.teamSource.set('FRIENDS');
    if (!this.teamSourceTouched) this.teamSource.set(clubs.length ? 'CLUB_MEMBERS' : 'FRIENDS');
    if (this.teamSource() === 'CLUB_MEMBERS' && this.memberClubId()) this.loadClubMembers(this.memberClubId()!);
  }

  setTeamSource(source: TeamSource): void {
    this.teamSourceTouched = true;
    this.teamSource.set(source);
    this.teammateQuery.set('');
    this.errorMessage.set('');
    if (source === 'CLUB_MEMBERS' && this.memberClubId()) this.loadClubMembers(this.memberClubId()!);
  }

  /** Đổi CLB nguồn: bỏ những người đã chọn từ CLB khác (server chỉ kiểm tra một CLB mỗi lượt). */
  selectMemberClub(clubId: string | null): void {
    this.memberClubId.set(clubId);
    this.teammateQuery.set('');
    this.teammates.update(items => items.filter(item => !item.clubId || item.clubId === clubId));
    if (clubId) this.loadClubMembers(clubId);
  }

  toggleTeammate(person: PartnerOption): void {
    if (this.teammateIds().has(person.userId)) {
      this.removeTeammate(person.userId);
      return;
    }
    if (this.teamFull()) return;
    const clubId = this.teamSource() === 'CLUB_MEMBERS' ? this.memberClubId() : null;
    this.teammates.update(items => [...items, { ...person, clubId }]);
    this.errorMessage.set('');
  }

  removeTeammate(userId: string): void {
    this.teammates.update(items => items.filter(item => item.userId !== userId));
  }

  goToStep(key: SetupStep): void {
    const target = this.steps().findIndex(item => item.key === key);
    // Tiến lên phải qua từng bước hợp lệ; lùi thì luôn được.
    if (target < 0 || (target > this.stepIndex() && !this.stepsValidUpTo(target))) return;
    this.errorMessage.set('');
    this.step.set(key);
  }

  nextStep(): void {
    if (!this.validateStep(this.step())) return;
    const next = this.steps()[this.stepIndex() + 1];
    if (next) {
      this.errorMessage.set('');
      this.step.set(next.key);
    }
  }

  prevStep(): void {
    const previous = this.steps()[this.stepIndex() - 1];
    if (previous) this.step.set(previous.key);
  }

  canVisit(index: number): boolean {
    return index <= this.stepIndex() || this.stepsValidUpTo(index);
  }

  private stepsValidUpTo(index: number): boolean {
    return this.steps().slice(0, index).every(item => this.stepValid(item.key));
  }

  private stepValid(key: SetupStep): boolean {
    if (key === 'TEAM') return this.teamReady();
    if (key === 'TIME') return this.timeValid();
    return true;
  }

  private validateStep(key: SetupStep): boolean {
    if (key === 'TEAM' && !this.teamReady()) {
      this.errorMessage.set(this.teamProblem());
      return false;
    }
    if (key === 'TIME' && !this.timeValid()) {
      this.errorMessage.set(this.timeProblem());
      return false;
    }
    return true;
  }

  private teamProblem(): string {
    if (this.representsClub()) return 'Hãy chọn CLB mà bạn đại diện thi đấu.';
    const missing = this.neededTeammates() - this.teammates().length;
    return this.teamSize() === 2
      ? 'Đánh đôi cần chọn bạn cặp. Chưa có ai thì đăng tìm người chơi ở Cộng đồng.'
      : `Đội ${this.formatLabel()} cần thêm ${missing} đồng đội. Thiếu người thì đăng tìm người chơi ở Cộng đồng.`;
  }

  private timeValid(): boolean {
    return !!this.playDate() && this.playDate() >= this.today
      && !!this.startTime() && !!this.endTime() && this.endTime() > this.startTime();
  }

  private timeProblem(): string {
    return !this.playDate() || this.playDate() < this.today
      ? 'Ngày chơi không được nằm trong quá khứ.'
      : 'Giờ kết thúc phải sau giờ bắt đầu.';
  }

  private stepSummary(key: SetupStep): string {
    switch (key) {
      case 'SPORT': return `${this.selectedSportLabel()} · ${this.formatLabel()}`;
      case 'TEAM': {
        if (this.representsClub()) return this.representedClubName() || 'Chọn CLB đại diện';
        return this.teamSize() === 2
          ? this.teammates()[0]?.fullName ?? 'Chưa chọn bạn cặp'
          : `${this.teammates().length + 1}/${this.teamSize()} người`;
      }
      case 'TIME': return `${this.shortDate(this.playDate())} · ${this.startTime()}–${this.endTime()}`;
      case 'PREFS': return `${this.skills.find(item => item.value === this.selectedSkill())?.label} · ELO ${this.eloRating()}`;
    }
  }

  private shortDate(value: string): string {
    return value ? new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })
      .format(new Date(`${value}T00:00:00`)) : '—';
  }

  private fold(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
  }

  private loadFriends(): void {
    if (this.friends() || this.friendsLoading()) return;
    const me = this.authService.currentUser?.userId ?? '';
    this.friendsLoading.set(true);
    this.friendRepository.getFriends().pipe(
      map(response => [...new Set((response.data ?? [])
        .filter(item => item.status === 'ACCEPTED')
        .map(item => item.requesterId === me ? item.addresseeId : item.requesterId)
        .filter(id => !!id && id !== me))]),
      switchMap(ids => ids.length ? forkJoin({ ids: of(ids), users: this.directory.resolve(ids) })
        : of({ ids, users: new Map() })),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.friendsLoading.set(false))
    ).subscribe({
      next: ({ ids, users }) => this.friends.set(ids
        .map(id => ({ userId: id, fullName: users.get(id)?.fullName || users.get(id)?.username || 'Người chơi' }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'))),
      error: () => this.friends.set([])
    });
  }

  private loadClubs(): void {
    if (this.clubMemberships() || this.clubsLoading() || !this.authService.currentUser) return;
    this.clubsLoading.set(true);
    this.clubRepository.getMyClubs().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.clubsLoading.set(false))
    ).subscribe({
      next: memberships => {
        this.clubMemberships.set(Array.isArray(memberships) ? memberships : []);
        this.syncTeamDefaults();
      },
      error: () => this.clubMemberships.set([])
    });
  }

  /** Thành viên đang hoạt động của một CLB, kèm tên; tải một lần mỗi CLB. */
  private loadClubMembers(clubId: string): void {
    if (this.clubMembers()[clubId] || this.membersLoading()) return;
    this.membersLoading.set(true);
    this.clubRepository.getClubMembers(clubId).pipe(
      map(members => [...new Set((members ?? []).filter(item => item.status === 'ACTIVE').map(item => item.userId))]),
      switchMap(ids => ids.length ? forkJoin({ ids: of(ids), users: this.directory.resolve(ids) })
        : of({ ids, users: new Map() })),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.membersLoading.set(false))
    ).subscribe({
      next: ({ ids, users }) => this.clubMembers.update(cache => ({
        ...cache,
        [clubId]: ids
          .map(id => ({ userId: id, fullName: users.get(id)?.fullName || users.get(id)?.username || 'Thành viên' }))
          .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'))
      })),
      error: () => this.clubMembers.update(cache => ({ ...cache, [clubId]: [] }))
    });
  }

  private sideUserIds(side: MatchmakingPlayer): string[] {
    if (side.participantType === 'CLUB') return side.managerIds ?? [];
    return side.members?.length ? side.members.map(item => item.userId) : [side.participantId];
  }

  private mySide(session: MatchmakingSession | null | undefined): MatchmakingPlayer | null {
    const userId = this.authService.currentUser?.userId;
    if (!session || !userId) return null;
    return session.participants.find(item => this.sideUserIds(item).includes(userId)) ?? null;
  }

  private onMySide(m: MatchmakingSession, userId: string | undefined): boolean {
    const mine = this.currentParticipant(m);
    return Boolean(userId && mine && this.sideUserIds(mine).includes(userId));
  }

  selectSkill(skill: MatchmakingSkill, suggestedElo: number): void {
    if (this.activeProfile()) return;
    this.selectedSkill.set(skill);
    this.eloRating.set(suggestedElo);
  }

  selectPlayStyle(style: MatchmakingPlayStyle): void {
    this.selectedPlayStyle.set(style);
  }

  selectMode(mode: MatchSelectionMode): void {
    this.selectionMode.set(mode);
  }

  refreshLocation(): void {
    if (this.locating()) return;
    this.resolveBrowserLocation();
  }

  startMatchmaking(): void {
    const user = this.authService.currentUser;
    if (!user) {
      this.authService.notifyAuthenticationRequired('Vui lòng đăng nhập để sử dụng AI ghép kèo.');
      return;
    }
    if (!this.validPreferences()) return;
    if (this.scheduleConflict()) {
      this.errorMessage.set(this.scheduleConflictMessage(this.scheduleConflict()!));
      return;
    }

    const location = this.coordinates();
    if (location) {
      this.enqueueWithCoordinates(location.latitude, location.longitude);
      return;
    }
    this.resolveBrowserLocation(true);
  }

  cancelSearch(): void {
    if (!this.isSearching()) return;
    this.aiRepository.leaveMatchmakingQueue()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.resetSearch(),
        error: error => this.errorMessage.set(this.userMessage(error, 'Không thể rời hàng chờ. Vui lòng thử lại.'))
      });
  }

  respond(decision: AcceptanceDecision): void {
    const session = this.session();
    if (!session || !this.canRespond(session) || this.responding()) return;
    this.responding.set(true);
    this.errorMessage.set('');
    this.aiRepository.decideMatch(session.sessionId, decision).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.responding.set(false))
    ).subscribe({
      next: updated => {
        this.applySession(updated);
        this.upsertHistory(updated);
      },
      error: error => this.errorMessage.set(this.userMessage(error, 'Không thể gửi phản hồi. Vui lòng thử lại.'))
    });
  }

  openChat(m: MatchmakingSession): void {
    const conversationId = m.proposal?.conversationId;
    if (conversationId) void this.router.navigate(['/chat', conversationId]);
  }

  openVenue(detail: MatchmakingSession): void {
    const status = detail.status;
    const bookingId = detail.proposal?.bookingId;
    if (bookingId && this.isDesignatedBooker(detail)
      && ['BOOKING_PENDING', 'CONFIRMED', 'CHECKED_IN', 'RESULT_PENDING', 'DISPUTED', 'COMPLETED'].includes(status)) {
      void this.router.navigate(['/booking/detail', bookingId]);
      return;
    }
    const venueId = detail?.proposal?.venueId;
    if (!venueId) return;
    const venueCourtId = detail?.proposal?.venueCourtId;
    if (venueCourtId && this.isDesignatedBooker(detail) && status === 'VENUE_SELECTED') {
      void this.router.navigate(['/booking/create'], {
        queryParams: {
          venueId,
          courtId: venueCourtId,
          date: detail?.playDate,
          startTime: detail?.startTime,
          endTime: detail?.endTime,
          matchmakingSessionId: detail?.sessionId
        }
      });
      return;
    }
    void this.router.navigate(['/venues', venueId], {
      queryParams: {
        date: detail?.playDate,
        venueCourtId: detail?.proposal?.venueCourtId,
        matchmakingSessionId: null
      }
    });
  }

  chooseCandidate(candidate: MatchCandidate): void {
    if (this.actionLoading()) return;
    this.actionLoading.set(true);
    this.errorMessage.set('');
    this.aiRepository.selectMatchmakingCandidate(candidate.participant.participantId).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.actionLoading.set(false))
    ).subscribe({
      next: session => this.applySession(session),
      error: error => this.errorMessage.set(this.userMessage(error, 'Đối thủ không còn trong hàng chờ.'))
    });
  }

  chooseVenue(venueId: string, venueCourtId?: string): void {
    const match = this.session();
    if (!match || !venueCourtId || !this.isDesignatedBooker(match) || this.actionLoading()) return;
    this.actionLoading.set(true);
    this.errorMessage.set('');
    this.aiRepository.selectMatchVenue(match.sessionId, venueId, venueCourtId).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.actionLoading.set(false))
    ).subscribe({
      next: session => this.applySession(session),
      error: error => this.errorMessage.set(this.userMessage(error, 'Không thể chọn sân này.'))
    });
  }

  refreshVenues(): void {
    const match = this.session();
    if (!match || match.status !== 'ACCEPTED' || this.actionLoading()) return;
    this.actionLoading.set(true);
    this.errorMessage.set('');
    this.aiRepository.refreshMatchVenues(match.sessionId).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.actionLoading.set(false))
    ).subscribe({
      next: session => this.applySession(session),
      error: error => this.errorMessage.set(this.userMessage(error, 'Không thể kiểm tra lại lịch sân.'))
    });
  }

  cancelMatch(): void {
    const match = this.session();
    if (!match || this.actionLoading()) return;
    this.actionLoading.set(true);
    this.errorMessage.set('');
    this.aiRepository.cancelMatchmakingSession(match.sessionId).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.actionLoading.set(false))
    ).subscribe({
      next: session => {
        this.applySession(session);
        this.upsertHistory(session);
      },
      error: error => this.errorMessage.set(this.userMessage(error, 'Không thể hủy kèo lúc này.'))
    });
  }

  submitResult(): void {
    const match = this.session();
    if (!match || this.actionLoading()) return;
    this.actionLoading.set(true);
    this.errorMessage.set('');
    this.aiRepository.submitMatchResult(match.sessionId, this.resultMyScore(), this.resultOpponentScore()).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.actionLoading.set(false))
    ).subscribe({
      next: session => this.applySession(session),
      error: error => this.errorMessage.set(this.userMessage(error, 'Không thể gửi kết quả.'))
    });
  }

  openFeedback(match: MatchmakingSession): void {
    this.feedbackRating.set(5);
    this.fairPlayRating.set(5);
    this.feedbackComment.set('');
    this.errorMessage.set('');
    this.feedbackTarget.set(match);
  }

  closeFeedback(): void {
    if (!this.actionLoading()) this.feedbackTarget.set(null);
  }

  /** Đánh giá được mọi trận đã hoàn tất của mình, kể cả mở từ lịch sử. */
  submitFeedback(): void {
    const match = this.feedbackTarget();
    if (!match || this.actionLoading()) return;
    this.actionLoading.set(true);
    this.errorMessage.set('');
    this.aiRepository.submitOpponentFeedback(
      match.sessionId,
      this.feedbackRating(),
      this.fairPlayRating(),
      this.feedbackComment() || undefined
    ).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.actionLoading.set(false))
    ).subscribe({
      next: updated => {
        if (updated.sessionId === this.session()?.sessionId) this.applySession(updated);
        if (this.selectedHistorySession()?.sessionId === updated.sessionId) this.selectedHistorySession.set(updated);
        this.history.update(items => items.map(item => item.sessionId === updated.sessionId ? updated : item));
        this.feedbackTarget.set(null);
      },
      error: error => this.errorMessage.set(this.userMessage(error, 'Không thể gửi đánh giá.'))
    });
  }

  /** Bạn cặp hoặc quản lý khác đã nhập thì cũng tính là bên mình đã nhập. */
  hasSubmittedResult(m: MatchmakingSession): boolean {
    return Boolean(this.myResultClaim(m));
  }

  hasSubmittedFeedback(m: MatchmakingSession): boolean {
    return Boolean(this.myFeedback(m));
  }

  /** Đánh giá bên mình đã gửi cho trận này (một bên chỉ đánh giá một lần). */
  myFeedback(m: MatchmakingSession) {
    return m.feedback?.find(item => this.onMySide(m, item.reviewerId)) ?? null;
  }

  /** "18:00:00" → "18:00". */
  hhmm(value: string | undefined | null): string {
    return value ? value.slice(0, 5) : '';
  }

  /** Đã chọn sân: giờ của kèo là giờ thi đấu (một slot), không còn là cả khung rảnh chung. */
  hasMatchTime(match: MatchmakingSession): boolean {
    return !!match.proposal?.venueId && match.status !== 'ACCEPTED';
  }

  /** ELO mới: của riêng mình khi chơi đơn/đôi, của CLB khi đấu CLB. */
  myEloAfter(m: MatchmakingSession): number | null {
    const mine = this.currentParticipant(m);
    const key = mine?.participantType === 'CLUB' ? mine.participantId : this.authService.currentUser?.userId;
    return key ? m.result?.eloUpdates?.[key] ?? null : null;
  }


  findAnotherMatch(): void {
    const previous = this.session();
    if (previous) this.upsertHistory(previous);
    this.stopPolling();
    this.session.set(null);
    this.selectedHistorySession.set(null);
    this.queueSize.set(null);
    this.elapsedSeconds.set(0);
    this.errorMessage.set('');
  }

  /** Về form thiết lập mà vẫn theo dõi kèo đang chạy (xem lại ở Ghép kèo gần đây). */
  backToSetup(): void {
    this.hideRestoredSession.set(true);
    this.errorMessage.set('');
  }

  historyOpponent(match: MatchmakingSession): MatchmakingPlayer | null {
    const mine = this.mySide(match);
    return match.participants.find(item => item !== mine) ?? match.participants[0] ?? null;
  }

  historyOpponentInitials(match: MatchmakingSession): string {
    return this.initials(this.historyOpponent(match)?.name);
  }

  /**
   * Chi tiết một kèo trong lịch sử hiện ở cột trái hàng dưới, hàng trên giữ nguyên. Kèo đang hiện ở hàng trên thì
   * chỉ cuộn lên đó, không hiện hai lần.
   */
  selectHistorySession(match: MatchmakingSession): void {
    const target = this.liveSession()?.sessionId === match.sessionId ? '.stage' : '.insights';
    if (target === '.insights') this.selectedHistorySession.set(match);
    if (!isPlatformBrowser(this.platformId)) return;
    const element = this.host.nativeElement.querySelector(target) as HTMLElement | null;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const top = element?.getBoundingClientRect().top ?? 0;
    if (element && (top < 0 || top > window.innerHeight * 0.6)) {
      element.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }

  loadMoreHistory(): void {
    if (this.historyLoading() || this.historyLoadingMore() || !this.historyHasMore()) return;
    this.historyLoadingMore.set(true);
    const offset = this.history().length;
    this.aiRepository.getMatchmakingHistory(MatchmakingComponent.HISTORY_PAGE_SIZE, offset)
      .pipe(
        catchError(() => of([] as MatchmakingSession[])),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(items => {
        this.historyLoadingMore.set(false);
        if (!items.length) {
          this.historyHasMore.set(false);
          return;
        }
        this.history.update(current => [...current, ...items]);
        this.historyHasMore.set(items.length >= MatchmakingComponent.HISTORY_PAGE_SIZE);
      });
  }

  clearHistorySelection(): void {
    this.selectedHistorySession.set(null);
  }

  isSelectedHistory(match: MatchmakingSession): boolean {
    return this.selectedHistorySession()?.sessionId === match.sessionId;
  }

  progressItemState(m: MatchmakingSession, index: number): { done: boolean; current: boolean } {
    const current = this.matchProgressStep(m.status);
    if (m.status === 'CONFIRMED') {
      // Deposit step is fully done; the pulsing "current" indicator moves
      // ahead to Check-in so CONFIRMED doesn't look identical to BOOKING_PENDING.
      return { done: index <= current, current: index === current + 1 };
    }
    return { done: index <= current, current: index === current };
  }

  conflictAllowedAfter(conflict: ScheduleConflict): string {
    return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' })
      .format(conflict.bufferedEnd);
  }

  historyDate(match: MatchmakingSession): string {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(`${match.playDate}T00:00:00`));
  }

  historyStatus(match: MatchmakingSession): string {
    return this.sessionStatusLabel(match.status);
  }

  sportLabel(sport: MatchmakingSport): string {
    return this.sports.find(item => item.value === sport)?.label ?? sport;
  }

  formatCountdown(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  trackHistory(_: number, item: MatchmakingSession): string {
    return item.sessionId;
  }

  private resolveBrowserLocation(startAfterResolve = false): void {
    if (!navigator.geolocation) {
      this.errorMessage.set('Trình duyệt không hỗ trợ định vị. Hãy thêm vị trí trong hồ sơ thể thao.');
      return;
    }

    this.errorMessage.set('');
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        const location: Coordinates = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          source: 'browser'
        };
        this.coordinates.set(location);
        this.locating.set(false);
        if (startAfterResolve) this.enqueueWithCoordinates(location.latitude, location.longitude);
      },
      () => {
        this.locating.set(false);
        this.errorMessage.set('Không thể lấy vị trí. Hãy cấp quyền định vị hoặc lưu vị trí trong hồ sơ thể thao.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }

  private enqueueWithCoordinates(latitude: number, longitude: number): void {
    const user = this.authService.currentUser;
    if (!user) return;
    const profile = this.activeProfile();
    const payload: JoinMatchmakingQueueRequest = {
      playerName: user.fullName || user.username || user.email,
      playerAvatar: user.avatarUrl,
      sportType: this.selectedSport(),
      skillLevel: this.selectedSkill(),
      eloRating: this.eloRating(),
      latitude,
      longitude,
      playDate: this.playDate(),
      startTime: this.startTime(),
      endTime: this.endTime(),
      timezone: this.timezone(),
      maxEloDifference: this.maxEloDifference(),
      maxDistanceKm: this.maxDistance(),
      preferredPositions: profile?.preferredPositions ?? [],
      playStyle: this.selectedPlayStyle(),
      matchCount: profile?.matchCount ?? 0,
      winRate: profile?.winRate ?? 0,
      selectionMode: this.selectionMode(),
      playFormat: this.playFormat(),
      partnerIds: this.teamSize() > 1 && !this.representsClub() ? this.teammates().map(item => item.userId) : undefined,
      teammateClubId: this.representsClub() ? undefined : this.teammates().find(item => item.clubId)?.clubId ?? undefined,
      clubId: this.representsClub() ? this.clubId() ?? undefined : undefined
    };
    this.enqueue(payload);
  }

  private enqueue(payload: JoinMatchmakingQueueRequest): void {
    this.isSearching.set(true);
    this.session.set(null);
    this.selectedHistorySession.set(null);
    this.hideRestoredSession.set(false);
    this.elapsedSeconds.set(0);
    this.startElapsedTimer();
    this.aiRepository.joinMatchmakingQueue(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          if (response.session) {
            this.applySession(response.session);
            this.upsertHistory(response.session);
            return;
          }
          if (this.selectionMode() === 'MANUAL') this.loadCandidates();
        },
        error: error => {
          this.resetSearch();
          this.errorMessage.set(this.userMessage(error, 'Không thể tham gia hàng chờ. Vui lòng thử lại.'));
        }
      });
  }

  private restoreState(): void {
    this.aiRepository.checkMatchmakingStatus().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.restoring.set(false))
    ).subscribe({
      next: response => {
        if (response.session) {
          this.applySession(response.session);
          this.hideRestoredSession.set(true);
          this.upsertHistory(response.session);
        } else if (response.status === 'QUEUED') {
          this.isSearching.set(true);
          this.queueSize.set(response.queueSize ?? null);
          this.startElapsedTimer();
          if (this.selectionMode() === 'MANUAL') this.loadCandidates();
        }
      },
      error: () => this.errorMessage.set('Chưa thể khôi phục trạng thái ghép kèo trước đó.')
    });
  }

  private applySession(session: MatchmakingSession): void {
    this.session.set(session);
    if (this.selectedHistorySession()?.sessionId === session.sessionId) {
      this.selectedHistorySession.set(session);
    }
    this.isSearching.set(false);
    this.elapsedTimer?.unsubscribe();
    this.scheduleExpiryRefresh(session);
    this.animateMatchDetail();
    this.seedResultFormFromOwnClaim(session);
  }

  private seedResultFormFromOwnClaim(session: MatchmakingSession): void {
    if (!['CHECKED_IN', 'RESULT_PENDING', 'DISPUTED'].includes(session.status)) return;
    if (this.resultMyScore() !== 0 || this.resultOpponentScore() !== 0) return;
    const claim = this.myResultClaim(session);
    if (!claim) return;
    const { my, opponent } = this.claimScoresFromMyPerspective(session, claim);
    this.resultMyScore.set(my);
    this.resultOpponentScore.set(opponent);
  }

  /** Tỷ số đã chốt, nhìn từ phía mình; null khi trận chưa có kết quả. */
  finalScore(m: MatchmakingSession): { my: number; opponent: number; outcome: 'WIN' | 'LOSS' | 'DRAW' } | null {
    if (!m.result || m.result.participantOneScore == null || m.result.participantTwoScore == null) return null;
    const { my, opponent } = this.claimScoresFromMyPerspective(m, m.result);
    return { my, opponent, outcome: my > opponent ? 'WIN' : my < opponent ? 'LOSS' : 'DRAW' };
  }

  myResultClaim(m: MatchmakingSession): MatchResultClaim | null {
    return m.resultClaims?.find(item => this.onMySide(m, item.submittedBy)) ?? null;
  }

  opponentResultClaim(m: MatchmakingSession): MatchResultClaim | null {
    return m.resultClaims?.find(item => item.submittedBy && !this.onMySide(m, item.submittedBy)) ?? null;
  }

  claimScoresFromMyPerspective(
    session: MatchmakingSession,
    claim: Pick<MatchResultClaim, 'participantOneScore' | 'participantTwoScore'>
  ): { my: number; opponent: number } {
    return session.participants[0] && session.participants[0] === this.mySide(session)
      ? { my: claim.participantOneScore, opponent: claim.participantTwoScore }
      : { my: claim.participantTwoScore, opponent: claim.participantOneScore };
  }

  private refreshFromRealtimeEvent(referenceId?: string): void {
    const activeSession = this.session();
    const isDifferentActiveSession = Boolean(
      referenceId
      && activeSession
      && activeSession.sessionId !== referenceId
      && !['REJECTED', 'EXPIRED', 'CANCELLED', 'COMPLETED'].includes(activeSession.status)
    );
    if (isDifferentActiveSession) return;

    if (this.realtimeRefreshInFlight) {
      this.realtimeRefreshPending = true;
      return;
    }

    // Whether the fetched session should become the tracked "current" session
    // (vs. a different/historical session that only needs its history entry
    // refreshed without disturbing whatever is currently tracked as active).
    const becomesCurrent = !referenceId || !activeSession || activeSession.sessionId === referenceId;

    this.realtimeRefreshInFlight = true;
    const request: Observable<{ session: MatchmakingSession | null; queueSize: number | null }> = referenceId
      ? this.aiRepository.getMatchmakingSession(referenceId).pipe(
          map(session => ({ session, queueSize: null }))
        )
      : this.aiRepository.checkMatchmakingStatus().pipe(
          map(response => ({
            session: response.session ?? null,
            queueSize: response.queueSize ?? null
          }))
        );

    request.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.realtimeRefreshInFlight = false;
        if (this.realtimeRefreshPending) {
          this.realtimeRefreshPending = false;
          this.refreshFromRealtimeEvent(this.session()?.sessionId ?? referenceId);
        }
      })
    ).subscribe({
      next: response => {
        this.errorMessage.set('');
        if (response.session && becomesCurrent) {
          this.queueSize.set(response.queueSize ?? null);
          this.applySession(response.session);
          if (this.selectedHistorySession()?.sessionId !== response.session.sessionId) this.hideRestoredSession.set(false);
          this.upsertHistory(response.session);
        } else if (response.session) {
          this.upsertHistory(response.session);
        } else if (this.selectionMode() === 'MANUAL' && this.isSearching()) {
          this.loadCandidates();
        }
      },
      error: error => this.errorMessage.set(
        this.userMessage(error, 'Chưa thể cập nhật thay đổi ghép kèo.')
      )
    });
  }

  private scheduleExpiryRefresh(session: MatchmakingSession): void {
    this.sessionExpiryRefresh?.unsubscribe();
    if (!['PROPOSED', 'ACCEPTED_BY_ONE'].includes(session.status) || !session.expiresAt) return;
    const delay = Math.max(0, new Date(session.expiresAt).getTime() - Date.now()) + 250;
    this.sessionExpiryRefresh = timer(delay).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.refreshFromRealtimeEvent(session.sessionId));
  }

  private startElapsedTimer(): void {
    this.elapsedTimer?.unsubscribe();
    this.elapsedTimer = timer(1000, 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.elapsedSeconds.update(value => value + 1));
  }

  private resetSearch(): void {
    this.stopPolling();
    this.isSearching.set(false);
    this.queueSize.set(null);
    this.elapsedSeconds.set(0);
    this.candidates.set([]);
  }

  private stopPolling(): void {
    this.elapsedTimer?.unsubscribe();
    this.sessionExpiryRefresh?.unsubscribe();
  }

  private applyProfileForSport(sport: MatchmakingSport): void {
    const profile = this.profiles().find(item => item.sportType === sport);
    if (!profile) {
      this.selectedSkill.set('INTERMEDIATE');
      this.eloRating.set(1200);
      this.maxDistance.set(10);
      this.selectedPlayStyle.set('BALANCED');
      this.coordinates.set(null);
      return;
    }

    this.selectedSkill.set(profile.skillLevel as MatchmakingSkill);
    this.eloRating.set(profile.eloRating);
    this.maxDistance.set(Math.round(profile.playRadiusKm || 10));
    if (profile.playStyle && this.isPlayStyle(profile.playStyle)) {
      this.selectedPlayStyle.set(profile.playStyle);
    }
    this.applyNextAvailability(profile.availabilities);
    if (profile.latitude != null && profile.longitude != null) {
      this.coordinates.set({
        latitude: profile.latitude,
        longitude: profile.longitude,
        source: 'profile'
      });
    } else {
      this.coordinates.set(null);
    }
  }

  private applyNextAvailability(availabilities: PlayerAvailability[]): void {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const candidates = availabilities
      .filter(slot => slot.active)
      .map(slot => {
        let daysAhead = (DAY_INDEX[slot.dayOfWeek] - now.getDay() + 7) % 7;
        if (daysAhead === 0 && this.timeToMinutes(slot.startTime) <= currentMinutes) {
          daysAhead = 7;
        }
        const date = new Date(now);
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + daysAhead);
        return { slot, date };
      })
      .sort((first, second) => {
        const dateDifference = first.date.getTime() - second.date.getTime();
        return dateDifference || first.slot.startTime.localeCompare(second.slot.startTime);
      });

    const next = candidates[0];
    if (!next) return;
    this.playDate.set(this.localDate(next.date));
    this.startTime.set(next.slot.startTime.slice(0, 5));
    this.endTime.set(next.slot.endTime.slice(0, 5));
    this.timezone.set(next.slot.timezone || 'Asia/Ho_Chi_Minh');
  }

  private timeToMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private localDateTime(date: string, time: string): Date | null {
    if (!date || !time) return null;
    const value = new Date(`${date}T${time.slice(0, 8)}`);
    return Number.isNaN(value.getTime()) ? null : value;
  }

  private uniqueSessions(sessions: Array<MatchmakingSession | null>): MatchmakingSession[] {
    const unique = new Map<string, MatchmakingSession>();
    for (const match of sessions) {
      if (match) unique.set(match.sessionId, match);
    }
    return [...unique.values()];
  }

  private scheduleConflictMessage(conflict: ScheduleConflict): string {
    const match = conflict.session;
    return `Khung giờ này trùng hoặc quá sát trận ${this.sportLabel(match.sportType)} `
      + `${match.startTime.slice(0, 5)}–${match.endTime.slice(0, 5)} ngày ${this.historyDate(match)}. `
      + `Hãy chọn thời gian sau ${this.conflictAllowedAfter(conflict)}.`;
  }

  private matchProgressStep(status?: MatchSessionStatus): number {
    if (!status) return 0;
    if (['PROPOSED', 'ACCEPTED_BY_ONE'].includes(status)) return 0;
    if (status === 'ACCEPTED') return 1;
    if (status === 'VENUE_SELECTED') return 2;
    if (['BOOKING_PENDING', 'CONFIRMED'].includes(status)) return 3;
    if (['CHECKED_IN', 'RESULT_PENDING', 'DISPUTED'].includes(status)) return 4;
    if (status === 'COMPLETED') return 5;
    return 0;
  }

  private animateMatchDetail(): void {
    if (!isPlatformBrowser(this.platformId)
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    requestAnimationFrame(() => this.zone.runOutsideAngular(() => {
      const root = this.host.nativeElement;
      gsap.fromTo(root.querySelector('.result-state--matched'),
        { autoAlpha: 0.72, y: 8 },
        { autoAlpha: 1, y: 0, duration: 0.34, ease: 'power2.out' });
      gsap.fromTo(root.querySelector('.player--opponent'),
        { autoAlpha: 0, x: 24, scale: 0.94 },
        { autoAlpha: 1, x: 0, scale: 1, duration: 0.48, delay: 0.08, ease: 'back.out(1.45)' });
      gsap.fromTo(root.querySelector('.match-progress__fill'),
        { scaleX: 0 },
        { scaleX: 1, duration: 0.65, delay: 0.12, ease: 'power2.out' });
    }));
  }

  private validPreferences(): boolean {
    // Sai ở bước nào thì đưa về đúng bước đó cùng thông báo.
    for (const key of ['TEAM', 'TIME'] as const) {
      if (this.steps().some(item => item.key === key) && !this.validateStep(key)) {
        this.step.set(key);
        return false;
      }
    }
    if (this.eloRating() < 0 || this.eloRating() > 5000) {
      this.errorMessage.set('ELO phải nằm trong khoảng từ 0 đến 5.000.');
      return false;
    }
    if (this.maxEloDifference() < 0 || this.maxEloDifference() > 2000) {
      this.errorMessage.set('Chênh lệch ELO tối đa không hợp lệ.');
      return false;
    }
    return true;
  }

  private upsertHistory(session: MatchmakingSession): void {
    this.history.update(items => [
      session,
      ...items.filter(item => item.sessionId !== session.sessionId)
    ]);
  }

  private isPlayStyle(value: string): value is MatchmakingPlayStyle {
    return ['BALANCED', 'FAIR_PLAY', 'COMPETITIVE'].includes(value);
  }

  private sessionStatusLabel(status?: MatchSessionStatus): string {
    const labels: Record<MatchSessionStatus, string> = {
      PROPOSED: 'Chờ xác nhận',
      ACCEPTED_BY_ONE: 'Một người đã đồng ý',
      ACCEPTED: 'Đã xác nhận',
      VENUE_SELECTED: 'Đã chọn sân',
      BOOKING_PENDING: 'Chờ thanh toán',
      CONFIRMED: 'Đã xác nhận',
      CHECKED_IN: 'Đã check-in',
      RESULT_PENDING: 'Chờ xác nhận kết quả',
      COMPLETED: 'Đã hoàn tất',
      DISPUTED: 'Kết quả chưa khớp',
      REJECTED: 'Đã từ chối',
      EXPIRED: 'Đã hết hạn',
      CANCELLED: 'Đã hủy'
    };
    return status ? labels[status] : 'Đang xử lý';
  }

  private loadCandidates(): void {
    this.aiRepository.getMatchmakingCandidates(5).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => of([] as MatchCandidate[]))
    ).subscribe(items => this.candidates.set(items));
  }

  private localDate(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatLocalDate(value: string): string {
    return new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(`${value}T00:00:00`));
  }

  initials(name?: string): string {
    if (!name) return 'GS';
    return name.trim().split(/\s+/).slice(-2).map(part => part.charAt(0).toUpperCase()).join('') || 'GS';
  }

  private userMessage(error: unknown, fallback: string): string {
    const response = error as { error?: { message?: unknown; detail?: unknown } };
    if (typeof response.error?.message === 'string' && response.error.message.trim()) {
      return response.error.message;
    }
    if (typeof response.error?.detail === 'string' && response.error.detail.trim()) {
      return response.error.detail;
    }
    return fallback;
  }
}
