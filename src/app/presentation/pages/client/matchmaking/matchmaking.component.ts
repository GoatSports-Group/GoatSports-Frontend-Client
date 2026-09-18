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
import { Observable, Subscription, catchError, finalize, forkJoin, map, of, timer } from 'rxjs';
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
import { AuthService } from '@presentation/services/auth.service';
import { NotificationService } from '@presentation/services/notification.service';
import { NotificationType } from '@application/dto/notification/notification.dto';

type MatchmakingPlayStyle = 'BALANCED' | 'FAIR_PLAY' | 'COMPETITIVE';
type Coordinates = { latitude: number; longitude: number; source: 'profile' | 'browser' };
type ScheduleConflict = { session: MatchmakingSession; bufferedStart: Date; bufferedEnd: Date };

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
  readonly displayedSession = computed(() => {
    const selected = this.selectedHistorySession();
    if (selected) return selected;
    return this.hideRestoredSession() ? null : this.session();
  });
  readonly isViewingHistory = computed(() => {
    const selected = this.selectedHistorySession();
    if (!selected) return false;
    return selected.sessionId !== this.session()?.sessionId;
  });
  readonly historyReturnLabel = computed(() =>
    this.session() && !this.hideRestoredSession() ? 'Trở lại trận hiện tại' : 'Đóng chi tiết'
  );
  readonly currentParticipant = computed(() => {
    const currentUserId = this.authService.currentUser?.userId;
    return this.displayedSession()?.participants.find(item => item.participantId === currentUserId) ?? null;
  });
  readonly opponent = computed(() => {
    const currentUserId = this.authService.currentUser?.userId;
    return this.displayedSession()?.participants.find(item => item.participantId !== currentUserId) ?? null;
  });
  readonly currentParticipantInitials = computed(() => this.initials(this.currentParticipant()?.name));
  readonly opponentInitials = computed(() => this.initials(this.opponent()?.name));
  readonly selectedSportLabel = computed(() =>
    this.sports.find(item => item.value === this.selectedSport())?.label ?? this.selectedSport()
  );
  readonly selectedPlayDateLabel = computed(() => this.formatLocalDate(this.playDate()));
  readonly matchDateLabel = computed(() => {
    const value = this.displayedSession()?.playDate;
    return value ? this.formatLocalDate(value) : '';
  });
  readonly activeProfile = computed(() =>
    this.profiles().find(item => item.sportType === this.selectedSport()) ?? null
  );
  readonly responseRemainingSeconds = computed(() => {
    const expiry = this.displayedSession()?.expiresAt;
    if (!expiry) return 0;
    return Math.max(0, Math.ceil((new Date(expiry).getTime() - this.nowMs()) / 1000));
  });
  readonly myDecision = computed(() => {
    const profileId = this.currentParticipant()?.participantProfileId;
    return this.displayedSession()?.acceptances.find(item => item.participantProfileId === profileId)?.decision ?? null;
  });
  readonly canRespond = computed(() => {
    if (this.isViewingHistory()) return false;
    const status = this.displayedSession()?.status;
    return !this.myDecision() && (status === 'PROPOSED' || status === 'ACCEPTED_BY_ONE')
      && this.responseRemainingSeconds() > 0;
  });
  readonly canOpenChat = computed(() =>
    Boolean(this.displayedSession()?.proposal?.conversationId)
  );
  readonly isDesignatedBooker = computed(() =>
    this.displayedSession()?.proposal?.designatedBookerId === this.authService.currentUser?.userId
  );
  readonly isTerminalMatchStatus = computed(() => {
    const status = this.displayedSession()?.status;
    return status === 'REJECTED' || status === 'EXPIRED' || status === 'CANCELLED';
  });
  readonly statusMessage = computed(() => {
    const status = this.displayedSession()?.status;
    if (status === 'ACCEPTED') return 'Hai bên đã xác nhận kèo';
    if (status === 'VENUE_SELECTED') return 'Đã chọn sân, chờ người đặt cọc';
    if (status === 'BOOKING_PENDING') return 'Đang chờ thanh toán tiền cọc';
    if (status === 'CONFIRMED') return 'Trận đấu đã được xác nhận';
    if (status === 'CHECKED_IN') return 'Hai người chơi có thể nhập kết quả';
    if (status === 'RESULT_PENDING') return 'Đang chờ đối thủ xác nhận kết quả';
    if (status === 'DISPUTED') return 'Kết quả chưa trùng khớp';
    if (status === 'COMPLETED') return 'Trận đấu đã hoàn tất';
    if (status === 'ACCEPTED_BY_ONE') return this.myDecision() === 'ACCEPTED'
      ? 'Đang chờ đối thủ xác nhận'
      : 'Đối thủ đã đồng ý, đến lượt bạn';
    if (status === 'REJECTED') return 'Kèo đã bị từ chối';
    if (status === 'EXPIRED') return 'Kèo đã hết thời gian xác nhận';
    if (status === 'CANCELLED') return 'Kèo đã bị hủy';
    return 'Đã tìm thấy đối thủ';
  });
  readonly statusLabel = computed(() => this.sessionStatusLabel(this.displayedSession()?.status));
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
  readonly progressStep = computed(() => this.matchProgressStep(this.displayedSession()?.status));
  readonly progressPercent = computed(() => `${this.progressStep() * 20}%`);

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
        gsap.from('.matchmaking-workspace > *', {
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
    this.selectedSport.set(sport);
    this.applyProfileForSport(sport);
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
    if (!session || !this.canRespond() || this.responding()) return;
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

  openChat(): void {
    const conversationId = this.displayedSession()?.proposal?.conversationId;
    if (conversationId) void this.router.navigate(['/chat', conversationId]);
  }

  openVenue(): void {
    const detail = this.displayedSession();
    const status = detail?.status ?? '';
    const bookingId = detail?.proposal?.bookingId;
    if (bookingId && this.isDesignatedBooker()
      && ['BOOKING_PENDING', 'CONFIRMED', 'CHECKED_IN', 'RESULT_PENDING', 'DISPUTED', 'COMPLETED'].includes(status)) {
      void this.router.navigate(['/booking/detail', bookingId]);
      return;
    }
    const venueId = detail?.proposal?.venueId;
    if (!venueId) return;
    const venueCourtId = detail?.proposal?.venueCourtId;
    if (venueCourtId && this.isDesignatedBooker() && status === 'VENUE_SELECTED') {
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
    if (!match || !venueCourtId || !this.isDesignatedBooker() || this.actionLoading()) return;
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

  submitFeedback(): void {
    const match = this.session();
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
      next: session => this.applySession(session),
      error: error => this.errorMessage.set(this.userMessage(error, 'Không thể gửi đánh giá.'))
    });
  }

  hasSubmittedResult(): boolean {
    const userId = this.authService.currentUser?.userId;
    return Boolean(userId && this.displayedSession()?.resultClaims?.some(item => item.submittedBy === userId));
  }

  hasSubmittedFeedback(): boolean {
    const userId = this.authService.currentUser?.userId;
    return Boolean(userId && this.displayedSession()?.feedback?.some(item => item.reviewerId === userId));
  }

  eloAfter(participantId?: string): number | null {
    if (!participantId) return null;
    return this.displayedSession()?.result?.eloUpdates?.[participantId] ?? null;
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

  historyOpponent(match: MatchmakingSession): MatchmakingPlayer | null {
    const currentUserId = this.authService.currentUser?.userId;
    return match.participants.find(item => item.participantId !== currentUserId)
      ?? match.participants[0]
      ?? null;
  }

  historyOpponentInitials(match: MatchmakingSession): string {
    return this.initials(this.historyOpponent(match)?.name);
  }

  selectHistorySession(match: MatchmakingSession): void {
    this.selectedHistorySession.set(match);
    this.animateMatchDetail();
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
    if (!this.session()) {
      this.isSearching.set(false);
      this.queueSize.set(null);
    }
    this.animateMatchDetail();
  }

  isSelectedHistory(match: MatchmakingSession): boolean {
    return this.selectedHistorySession()?.sessionId === match.sessionId;
  }

  progressItemState(index: number): { done: boolean; current: boolean } {
    const current = this.progressStep();
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
      selectionMode: this.selectionMode()
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
    const claim = this.myResultClaim();
    if (!claim) return;
    const { my, opponent } = this.claimScoresFromMyPerspective(claim);
    this.resultMyScore.set(my);
    this.resultOpponentScore.set(opponent);
  }

  myResultClaim(): MatchResultClaim | null {
    const userId = this.authService.currentUser?.userId;
    return this.displayedSession()?.resultClaims?.find(item => item.submittedBy === userId) ?? null;
  }

  opponentResultClaim(): MatchResultClaim | null {
    const userId = this.authService.currentUser?.userId;
    return this.displayedSession()?.resultClaims?.find(item => item.submittedBy && item.submittedBy !== userId) ?? null;
  }

  claimScoresFromMyPerspective(claim: MatchResultClaim): { my: number; opponent: number } {
    const session = this.displayedSession();
    const firstParticipantId = session?.participants[0]?.participantId;
    const userId = this.authService.currentUser?.userId;
    return firstParticipantId === userId
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
          this.hideRestoredSession.set(false);
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
    if (!this.playDate() || this.playDate() < this.today) {
      this.errorMessage.set('Ngày chơi không được nằm trong quá khứ.');
      return false;
    }
    if (!this.startTime() || !this.endTime() || this.endTime() <= this.startTime()) {
      this.errorMessage.set('Giờ kết thúc phải sau giờ bắt đầu.');
      return false;
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
