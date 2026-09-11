import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subscription, finalize, switchMap, timer } from 'rxjs';
import { AiRepositoryPort } from '@application/ports/ai.repository.port';
import {
  AcceptanceDecision,
  JoinMatchmakingQueueRequest,
  MatchmakingSession,
  MatchmakingSkill,
  MatchmakingSport
} from '@application/dto/matchmaking/matchmaking.dto';
import { AuthService } from '@presentation/services/auth.service';


@Component({
  selector: 'app-matchmaking',
  templateUrl: './matchmaking.component.html',
  styleUrls: ['./matchmaking.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class MatchmakingComponent implements OnInit {
  private readonly aiRepository = inject(AiRepositoryPort);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly selectedSport = signal<MatchmakingSport>('BADMINTON');
  readonly selectedSkill = signal<MatchmakingSkill>('INTERMEDIATE');
  readonly eloRating = signal(1200);
  readonly maxEloDifference = signal(300);
  readonly maxDistance = signal(10);
  readonly playDate = signal(this.localDate(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  readonly startTime = signal('18:00');
  readonly endTime = signal('20:00');
  readonly locating = signal(false);
  readonly isSearching = signal(false);
  readonly restoring = signal(true);
  readonly responding = signal(false);
  readonly elapsedSeconds = signal(0);
  readonly queueSize = signal<number | null>(null);
  readonly session = signal<MatchmakingSession | null>(null);
  readonly errorMessage = signal('');

  readonly today = this.localDate(new Date());
  readonly sports: ReadonlyArray<{ label: string; value: MatchmakingSport; icon: string }> = [
    { label: 'Cầu lông', value: 'BADMINTON', icon: 'activity' },
    { label: 'Pickleball', value: 'PICKLEBALL', icon: 'circle-dot' },
    { label: 'Tennis', value: 'TENNIS', icon: 'circle' },
    { label: 'Bóng đá', value: 'FOOTBALL', icon: 'dribbble' },
    { label: 'Bóng rổ', value: 'BASKETBALL', icon: 'circle-dot-dashed' },
    { label: 'Bóng chuyền', value: 'VOLLEYBALL', icon: 'circle-dot' }
  ];
  readonly skills: ReadonlyArray<{ label: string; value: MatchmakingSkill; suggestedElo: number }> = [
    { label: 'Mới chơi', value: 'BEGINNER', suggestedElo: 900 },
    { label: 'Trung bình', value: 'INTERMEDIATE', suggestedElo: 1200 },
    { label: 'Nâng cao', value: 'ADVANCED', suggestedElo: 1500 },
    { label: 'Chuyên nghiệp', value: 'PRO', suggestedElo: 1800 }
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
  readonly myDecision = computed(() => {
    const profileId = this.currentParticipant()?.participantProfileId;
    return this.session()?.acceptances.find(item => item.participantProfileId === profileId)?.decision ?? null;
  });
  readonly canRespond = computed(() => {
    const status = this.session()?.status;
    return !this.myDecision() && (status === 'PROPOSED' || status === 'ACCEPTED_BY_ONE');
  });
  readonly canOpenChat = computed(() =>
    this.session()?.status === 'ACCEPTED' && Boolean(this.session()?.proposal?.conversationId)
  );
  readonly isDesignatedBooker = computed(() =>
    this.session()?.proposal?.designatedBookerId === this.authService.currentUser?.userId
  );
  readonly statusMessage = computed(() => {
    const status = this.session()?.status;
    if (status === 'ACCEPTED') return 'Hai bên đã xác nhận kèo';
    if (status === 'ACCEPTED_BY_ONE') return this.myDecision() === 'ACCEPTED'
      ? 'Đang chờ đối thủ xác nhận'
      : 'Đối thủ đã đồng ý, đến lượt bạn';
    if (status === 'REJECTED') return 'Kèo đã bị từ chối';
    if (status === 'EXPIRED') return 'Kèo đã hết thời gian xác nhận';
    if (status === 'CANCELLED') return 'Kèo đã bị hủy';
    return 'Đã tìm thấy đối thủ';
  });
  readonly statusLabel = computed(() => {
    const labels: Record<string, string> = {
      PROPOSED: 'Chờ xác nhận',
      ACCEPTED_BY_ONE: 'Một người đã đồng ý',
      ACCEPTED: 'Đã xác nhận',
      REJECTED: 'Đã từ chối',
      EXPIRED: 'Đã hết hạn',
      CANCELLED: 'Đã hủy'
    };
    return labels[this.session()?.status ?? ''] ?? 'Đang xử lý';
  });

  private queuePoll?: Subscription;
  private sessionPoll?: Subscription;
  private elapsedTimer?: Subscription;

  ngOnInit(): void {
    if (!this.authService.currentUser) {
      this.restoring.set(false);
      return;
    }
    this.restoreState();
  }

  selectSport(sport: MatchmakingSport): void {
    this.selectedSport.set(sport);
  }

  selectSkill(skill: MatchmakingSkill, suggestedElo: number): void {
    this.selectedSkill.set(skill);
    this.eloRating.set(suggestedElo);
  }

  startMatchmaking(): void {
    const user = this.authService.currentUser;
    if (!user) {
      this.authService.notifyAuthenticationRequired('Vui lòng đăng nhập để sử dụng AI ghép kèo.');
      return;
    }
    if (!this.validSchedule()) return;
    if (!navigator.geolocation) {
      this.errorMessage.set('Trình duyệt không hỗ trợ định vị. Vui lòng dùng thiết bị khác để ghép kèo theo khu vực.');
      return;
    }

    this.errorMessage.set('');
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        this.locating.set(false);
        this.enqueue({
          playerName: user.fullName || user.username || user.email,
          playerAvatar: user.avatarUrl,
          sportType: this.selectedSport(),
          skillLevel: this.selectedSkill(),
          eloRating: this.eloRating(),
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          playDate: this.playDate(),
          startTime: this.startTime(),
          endTime: this.endTime(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh',
          maxEloDifference: this.maxEloDifference(),
          maxDistanceKm: this.maxDistance(),
          preferredPositions: [],
          playStyle: 'BALANCED',
          matchCount: 0,
          winRate: 0
        });
      },
      () => {
        this.locating.set(false);
        this.errorMessage.set('Không thể lấy vị trí. Hãy cấp quyền định vị rồi thử lại.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
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
      next: updated => this.applySession(updated),
      error: error => this.errorMessage.set(this.userMessage(error, 'Không thể gửi phản hồi. Vui lòng thử lại.'))
    });
  }

  openChat(): void {
    const conversationId = this.session()?.proposal?.conversationId;
    if (conversationId) void this.router.navigate(['/chat', conversationId]);
  }

  openVenue(): void {
    const venueId = this.session()?.proposal?.venueId;
    if (venueId) {
      void this.router.navigate(['/venues', venueId], {
        queryParams: {
          date: this.session()?.playDate,
          matchmakingSessionId: this.session()?.status === 'ACCEPTED' && this.isDesignatedBooker()
            ? this.session()?.sessionId
            : null
        }
      });
    }
  }

  findAnotherMatch(): void {
    this.stopPolling();
    this.session.set(null);
    this.queueSize.set(null);
    this.elapsedSeconds.set(0);
    this.errorMessage.set('');
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
      switchMap(() => this.aiRepository.checkMatchmakingStatus()),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: response => {
        this.queueSize.set(response.queueSize ?? null);
        if (response.session) this.applySession(response.session);
      },
      error: () => this.errorMessage.set('Mất kết nối khi kiểm tra hàng chờ. Hệ thống sẽ tiếp tục thử lại.')
    });
  }

  private startSessionPolling(sessionId: string): void {
    this.sessionPoll?.unsubscribe();
    this.sessionPoll = timer(3000, 3000).pipe(
      switchMap(() => this.aiRepository.getMatchmakingSession(sessionId)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: updated => this.applySession(updated, false),
      error: () => this.errorMessage.set('Chưa thể cập nhật phản hồi của đối thủ. Hệ thống sẽ tiếp tục thử lại.')
    });
  }

  private applySession(session: MatchmakingSession, startWatcher = true): void {
    this.session.set(session);
    this.isSearching.set(false);
    this.queuePoll?.unsubscribe();
    this.elapsedTimer?.unsubscribe();
    this.errorMessage.set('');
    const awaitingDecision = session.status === 'PROPOSED' || session.status === 'ACCEPTED_BY_ONE';
    if (awaitingDecision && startWatcher) this.startSessionPolling(session.sessionId);
    if (!awaitingDecision) this.sessionPoll?.unsubscribe();
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
  }

  private stopPolling(): void {
    this.queuePoll?.unsubscribe();
    this.sessionPoll?.unsubscribe();
    this.elapsedTimer?.unsubscribe();
  }

  private validSchedule(): boolean {
    if (!this.playDate() || this.playDate() < this.today) {
      this.errorMessage.set('Ngày chơi không được nằm trong quá khứ.');
      return false;
    }
    if (!this.startTime() || !this.endTime() || this.endTime() <= this.startTime()) {
      this.errorMessage.set('Giờ kết thúc phải sau giờ bắt đầu.');
      return false;
    }
    return true;
  }

  private localDate(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatLocalDate(value: string): string {
    return new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(new Date(`${value}T00:00:00`));
  }

  private initials(name?: string): string {
    if (!name) return 'GS';
    return name.trim().split(/\s+/).slice(-2).map(part => part.charAt(0).toUpperCase()).join('') || 'GS';
  }

  private userMessage(error: unknown, fallback: string): string {
    const response = error as { error?: { message?: unknown; detail?: unknown } };
    if (typeof response.error?.message === 'string' && response.error.message.trim()) return response.error.message;
    if (typeof response.error?.detail === 'string' && response.error.detail.trim()) return response.error.detail;
    return fallback;
  }
}
