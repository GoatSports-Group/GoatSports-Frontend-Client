import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { EMPTY, Subscription, catchError, finalize, forkJoin, of, switchMap, timer } from 'rxjs';
import gsap from 'gsap';
import { AiRepositoryPort } from '@application/ports/ai.repository.port';
import {
  AcceptanceDecision,
  JoinMatchmakingQueueRequest,
  MatchCandidate,
  MatchmakingPlayer,
  MatchSelectionMode,
  MatchmakingSession,
  MatchmakingSkill,
  MatchmakingSport,
  MatchSessionStatus
} from '@application/dto/matchmaking/matchmaking.dto';
import { PlayerSportProfile } from '@application/dto/player-sport-profile/player-sport-profile.dto';
import {
  PLAYER_SPORT_PROFILE_REPOSITORY_TOKEN,
  PlayerSportProfileRepository
} from '@application/ports/persistence/player-sport-profile.repository';
import { AuthService } from '@presentation/services/auth.service';

type MatchmakingPlayStyle = 'BALANCED' | 'FAIR_PLAY' | 'COMPETITIVE';
type Coordinates = { latitude: number; longitude: number; source: 'profile' | 'browser' };

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
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);
  private animationContext?: ReturnType<typeof gsap.context>;

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
  readonly elapsedSeconds = signal(0);
  readonly nowMs = signal(Date.now());
  readonly queueSize = signal<number | null>(null);
  readonly session = signal<MatchmakingSession | null>(null);
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
    { label: 'Mới chơi', helper: 'Dưới 6 tháng', value: 'BEGINNER', suggestedElo: 900 },
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

  readonly currentParticipant = computed(() => {
    const currentUserId = this.authService.currentUser?.userId;
    return this.session()?.participants.find(item => item.participantId === currentUserId) ?? null;
  });
  readonly opponent = computed(() => {
    const currentUserId = this.authService.currentUser?.userId;
    return this.session()?.participants.find(item => item.participantId !== currentUserId) ?? null;
  });
  readonly currentParticipantInitials = computed(() => this.initials(this.currentParticipant()?.name));
  readonly opponentInitials = computed(() => this.initials(this.opponent()?.name));
  readonly selectedSportLabel = computed(() =>
    this.sports.find(item => item.value === this.selectedSport())?.label ?? this.selectedSport()
  );
  readonly selectedPlayDateLabel = computed(() => this.formatLocalDate(this.playDate()));
  readonly matchDateLabel = computed(() => {
    const value = this.session()?.playDate;
    return value ? this.formatLocalDate(value) : '';
  });
  readonly activeProfile = computed(() =>
    this.profiles().find(item => item.sportType === this.selectedSport()) ?? null
  );
  readonly responseRemainingSeconds = computed(() => {
    const expiry = this.session()?.expiresAt;
    if (!expiry) return 0;
    return Math.max(0, Math.ceil((new Date(expiry).getTime() - this.nowMs()) / 1000));
  });
  readonly myDecision = computed(() => {
    const profileId = this.currentParticipant()?.participantProfileId;
    return this.session()?.acceptances.find(item => item.participantProfileId === profileId)?.decision ?? null;
  });
  readonly canRespond = computed(() => {
    const status = this.session()?.status;
    return !this.myDecision() && (status === 'PROPOSED' || status === 'ACCEPTED_BY_ONE')
      && this.responseRemainingSeconds() > 0;
  });
  readonly canOpenChat = computed(() =>
    Boolean(this.session()?.proposal?.conversationId)
  );
  readonly isDesignatedBooker = computed(() =>
    this.session()?.proposal?.designatedBookerId === this.authService.currentUser?.userId
  );
  readonly statusMessage = computed(() => {
    const status = this.session()?.status;
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
  readonly statusLabel = computed(() => this.sessionStatusLabel(this.session()?.status));

  private queuePoll?: Subscription;
  private sessionPoll?: Subscription;
  private elapsedTimer?: Subscription;

  ngOnInit(): void {
    timer(0, 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.nowMs.set(Date.now()));

    if (!this.authService.currentUser) {
      this.restoring.set(false);
      this.historyLoading.set(false);
      return;
    }

    forkJoin({
      profiles: this.profileRepository.getMyProfiles().pipe(
        catchError(() => of([] as PlayerSportProfile[]))
      ),
      history: this.aiRepository.getMatchmakingHistory(5).pipe(
        catchError(() => of([] as MatchmakingSession[]))
      )
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ profiles, history }) => {
        this.profiles.set(Array.isArray(profiles) ? profiles : []);
        this.history.set(Array.isArray(history) ? history : []);
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
    if (!isPlatformBrowser(this.platformId)
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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

  selectSport(sport: MatchmakingSport): void {
    this.selectedSport.set(sport);
    this.applyProfileForSport(sport);
  }

  selectSkill(skill: MatchmakingSkill, suggestedElo: number): void {
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
    const conversationId = this.session()?.proposal?.conversationId;
    if (conversationId) void this.router.navigate(['/chat', conversationId]);
  }

  openVenue(): void {
    const bookingId = this.session()?.proposal?.bookingId;
    if (bookingId && ['CONFIRMED', 'CHECKED_IN', 'RESULT_PENDING', 'COMPLETED'].includes(this.session()?.status ?? '')) {
      void this.router.navigate(['/booking/detail', bookingId]);
      return;
    }
    const venueId = this.session()?.proposal?.venueId;
    if (!venueId) return;
    const venueCourtId = this.session()?.proposal?.venueCourtId;
    if (venueCourtId && this.isDesignatedBooker() && ['VENUE_SELECTED', 'BOOKING_PENDING'].includes(this.session()?.status ?? '')) {
      void this.router.navigate(['/booking/create'], {
        queryParams: {
          venueId,
          courtId: venueCourtId,
          date: this.session()?.playDate,
          startTime: this.session()?.startTime,
          endTime: this.session()?.endTime,
          matchmakingSessionId: this.session()?.sessionId
        }
      });
      return;
    }
    void this.router.navigate(['/venues', venueId], {
      queryParams: {
        date: this.session()?.playDate,
        venueCourtId: this.session()?.proposal?.venueCourtId,
        matchmakingSessionId: null
      }
    });
  }

  chooseCandidate(candidate: MatchCandidate): void {
    if (this.actionLoading()) return;
    this.actionLoading.set(true);
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
    this.aiRepository.selectMatchVenue(match.sessionId, venueId, venueCourtId).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.actionLoading.set(false))
    ).subscribe({
      next: session => this.applySession(session),
      error: error => this.errorMessage.set(this.userMessage(error, 'Không thể chọn sân này.'))
    });
  }

  submitResult(): void {
    const match = this.session();
    if (!match || this.actionLoading()) return;
    this.actionLoading.set(true);
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
    return Boolean(userId && this.session()?.resultClaims?.some(item => item.submittedBy === userId));
  }

  hasSubmittedFeedback(): boolean {
    const userId = this.authService.currentUser?.userId;
    return Boolean(userId && this.session()?.feedback?.some(item => item.reviewerId === userId));
  }

  eloAfter(participantId?: string): number | null {
    if (!participantId) return null;
    return this.session()?.result?.eloUpdates?.[participantId] ?? null;
  }

  findAnotherMatch(): void {
    const previous = this.session();
    if (previous) this.upsertHistory(previous);
    this.stopPolling();
    this.session.set(null);
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
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh',
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
          this.startQueuePolling();
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
          this.upsertHistory(response.session);
        } else if (response.status === 'QUEUED') {
          this.isSearching.set(true);
          this.queueSize.set(response.queueSize ?? null);
          this.startElapsedTimer();
          this.startQueuePolling();
        }
      },
      error: () => this.errorMessage.set('Chưa thể khôi phục trạng thái ghép kèo trước đó.')
    });
  }

  private startQueuePolling(): void {
    this.queuePoll?.unsubscribe();
    this.queuePoll = timer(0, 3000).pipe(
      switchMap(() => this.aiRepository.checkMatchmakingStatus().pipe(
        catchError(() => {
          this.errorMessage.set('Mất kết nối khi kiểm tra hàng chờ. Hệ thống đang tự kết nối lại.');
          return EMPTY;
        })
      )),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(response => {
      this.errorMessage.set('');
      this.queueSize.set(response.queueSize ?? null);
      if (response.session) {
        this.applySession(response.session);
        this.upsertHistory(response.session);
      }
      if (!response.session) this.loadCandidates();
    });
  }

  private startSessionPolling(sessionId: string): void {
    this.sessionPoll?.unsubscribe();
    this.sessionPoll = timer(3000, 3000).pipe(
      switchMap(() => this.aiRepository.getMatchmakingSession(sessionId).pipe(
        catchError(() => {
          this.errorMessage.set('Chưa thể cập nhật phản hồi của đối thủ. Hệ thống đang tự kết nối lại.');
          return EMPTY;
        })
      )),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(updated => {
      this.errorMessage.set('');
      this.applySession(updated, false);
      this.upsertHistory(updated);
    });
  }

  private applySession(session: MatchmakingSession, startWatcher = true): void {
    this.session.set(session);
    this.isSearching.set(false);
    this.queuePoll?.unsubscribe();
    this.elapsedTimer?.unsubscribe();
    const watchable = !['REJECTED', 'EXPIRED', 'CANCELLED', 'COMPLETED'].includes(session.status);
    if (watchable && startWatcher) this.startSessionPolling(session.sessionId);
    if (!watchable) this.sessionPoll?.unsubscribe();
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
    this.queuePoll?.unsubscribe();
    this.sessionPoll?.unsubscribe();
    this.elapsedTimer?.unsubscribe();
  }

  private applyProfileForSport(sport: MatchmakingSport): void {
    const profile = this.profiles().find(item => item.sportType === sport);
    if (!profile) {
      this.coordinates.set(null);
      return;
    }

    this.selectedSkill.set(profile.skillLevel as MatchmakingSkill);
    this.eloRating.set(profile.eloRating);
    this.maxDistance.set(Math.round(profile.playRadiusKm || 10));
    if (profile.playStyle && this.isPlayStyle(profile.playStyle)) {
      this.selectedPlayStyle.set(profile.playStyle);
    }
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
    ].slice(0, 5));
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
