import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { VENUE_SEARCH_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-search.repository';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { User } from '@application/dto/user/user.dto';
import {
  TournamentEligibilityRule as TournamentEligibilityRuleModel,
  TournamentFixture as TournamentFixtureModel, Tournament as TournamentModel,
  TournamentLineup, TournamentRegistration as TournamentRegistrationModel,
  TournamentReservation as TournamentReservationModel,
  TournamentStanding as TournamentStandingModel,
  TournamentStatus
} from '@application/dto/tournament/tournament.dto';
import { AuthService } from '@presentation/services/auth.service';
import { PlayerDirectoryService } from '@presentation/services/player-directory.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { PendingBookingPaymentService } from '@presentation/services/pending-booking-payment.service';
import {
  FORMAT_LABEL, HOLDING_STATUSES, LINEUP_ROLE_LABEL, MEMBER_META, PAYMENT_META, REGISTRATION_META, SKILL_LABEL,
  SPORT_LABEL, STATUS_META, dayLabel, fillPercent, formatVnd, isoDate, ruleLabel
} from './tournament-view';

type DetailTab = 'OVERVIEW' | 'MATCHES' | 'BRACKET' | 'STANDINGS' | 'TEAMS';

/** Một ngày thi đấu trong tab Lịch thi đấu; trận chưa xếp sân gom vào nhóm cuối (date = null). */
interface MatchDay { date: string | null; label: string; fixtures: TournamentFixtureModel[]; }

type FormResult = 'W' | 'D' | 'L';

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  run: () => void;
}

interface TimelineStep { label: string; date: string; state: 'done' | 'current' | 'upcoming'; }

const LOCKED: readonly TournamentStatus[] = ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

/**
 * Trang giai phia nguoi choi: xem, dang ky ca nhan / lap doi, tra loi loi moi, dong le phi trong 24 gio,
 * rut dang ky. Chu san tao va dieu hanh giai o goat-sports-admin (khong dang nhap client).
 */
@Component({
  selector: 'app-tournament-detail', templateUrl: './tournament-detail.component.html',
  styleUrls: ['./tournament-detail.component.scss'], changeDetection: ChangeDetectionStrategy.OnPush, standalone: false
})
export class TournamentDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly repository = inject(TournamentRepositoryPort);
  private readonly clubs = inject(ClubRepositoryPort);
  private readonly venues = inject(VENUE_SEARCH_REPOSITORY_TOKEN);
  private readonly auth = inject(AuthService);
  private readonly directory = inject(PlayerDirectoryService);
  private readonly notify = inject(NotifyService);
  private readonly pendingPayment = inject(PendingBookingPaymentService);
  readonly tournamentId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly me = this.auth.currentUser?.userId ?? null;

  readonly statusMeta = STATUS_META;
  readonly registrationMeta = REGISTRATION_META;
  readonly paymentMeta = PAYMENT_META;
  readonly memberMeta = MEMBER_META;
  readonly sportLabel = SPORT_LABEL;
  readonly formatLabel = FORMAT_LABEL;
  readonly skillLabel = SKILL_LABEL;
  readonly lineupRoleLabel = LINEUP_ROLE_LABEL;
  readonly formatVnd = formatVnd;
  readonly ruleLabel = ruleLabel;
  readonly fillPercent = fillPercent;

  readonly tournament = signal<TournamentModel | null>(null);
  readonly teams = signal<TournamentRegistrationModel[]>([]);
  readonly fixtures = signal<TournamentFixtureModel[]>([]);
  readonly standings = signal<TournamentStandingModel[]>([]);
  readonly eligibilityRules = signal<TournamentEligibilityRuleModel[]>([]);
  readonly reservations = signal<TournamentReservationModel[]>([]);
  readonly users = signal<ReadonlyMap<string, User>>(new Map());
  readonly clubNames = signal<ReadonlyMap<string, string>>(new Map());
  readonly venueName = signal<string | null>(null);
  readonly courtNames = signal<ReadonlyMap<string, string>>(new Map());

  readonly activeTab = signal<DetailTab>('OVERVIEW');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly mutating = signal(false);
  /** Dong ho cho dem nguoc han dong phi, cap nhat moi 30 giay. */
  readonly now = signal(Date.now());

  readonly showRegister = signal(false);
  readonly showInvite = signal(false);
  readonly lineupOf = signal<TournamentRegistrationModel | null>(null);
  /** Trận đang mở xem trước (tỷ số, lịch, đội hình). */
  readonly selectedFixture = signal<TournamentFixtureModel | null>(null);
  readonly confirm = signal<ConfirmState | null>(null);

  readonly status = computed<TournamentStatus | null>(() => this.tournament()?.status ?? null);
  readonly isTeamEvent = computed(() => this.tournament()?.participantType === 'TEAM');
  readonly holdingTeams = computed(() => this.teams().filter(item => HOLDING_STATUSES.has(item.status)));

  /**
   * Dang ky cua toi: toi dang ky (doi truong / ca nhan) hoac da nhan loi vao doi.
   * Uu tien dang ky con giu suat; khong co thi lay cai gan nhat de thay ly do dong / trang thai hoan phi.
   */
  readonly myRegistration = computed(() => {
    if (!this.me) return null;
    const mine = this.teams().filter(item => item.registeredBy === this.me
      || item.lineups?.some(line => line.playerId === this.me && line.memberStatus !== 'INVITED' && line.memberStatus !== 'DECLINED'));
    return mine.find(item => HOLDING_STATUSES.has(item.status)) ?? mine[mine.length - 1] ?? null;
  });
  readonly isRegistrant = computed(() => this.myRegistration()?.registeredBy === this.me);
  readonly isHolding = computed(() => !!this.myRegistration() && HOLDING_STATUSES.has(this.myRegistration()!.status));
  readonly highlightId = computed(() => this.isHolding() ? this.myRegistration()!.registrationId : null);
  /** Doi hinh con hieu luc (bo nguoi da tu choi). */
  readonly myLineup = computed<TournamentLineup[]>(() => (this.myRegistration()?.lineups ?? [])
    .filter(line => line.memberStatus !== 'DECLINED'));
  readonly acceptedCount = computed(() => this.myLineup().filter(line => (line.memberStatus ?? 'ACCEPTED') === 'ACCEPTED').length);
  readonly missingMembers = computed(() => Math.max(0, (this.tournament()?.rosterMin ?? 1) - this.acceptedCount()));
  readonly canInvite = computed(() => this.isRegistrant() && this.isHolding() && this.isTeamEvent()
    && !LOCKED.includes(this.status()!) && this.myLineup().length < (this.tournament()?.rosterMax ?? 1));
  readonly canWithdraw = computed(() => this.isHolding() && !LOCKED.includes(this.status()!));

  readonly feeAmount = computed(() => this.myRegistration()?.feeAmount ?? this.tournament()?.entryFee ?? 0);
  /** Thoi gian con lai de dong phi, null neu khong ap dung. */
  readonly paymentLeft = computed<string | null>(() => {
    const deadline = this.myRegistration()?.paymentDeadline;
    if (this.myRegistration()?.status !== 'PENDING_PAYMENT' || !deadline) return null;
    const ms = new Date(deadline).getTime() - this.now();
    if (ms <= 0) return 'Đã quá hạn';
    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    return hours ? `Còn ${hours} giờ ${minutes} phút` : `Còn ${minutes} phút`;
  });
  readonly paymentUrgent = computed(() => {
    const deadline = this.myRegistration()?.paymentDeadline;
    return !!deadline && new Date(deadline).getTime() - this.now() < 3 * 3_600_000;
  });

  readonly teamById = computed<ReadonlyMap<string, TournamentRegistrationModel>>(() =>
    new Map(this.teams().map(item => [item.registrationId, item])));
  readonly reservationById = computed<ReadonlyMap<string, TournamentReservationModel>>(() =>
    new Map(this.reservations().map(item => [item.reservationId, item])));
  /** Tên người chơi (tài khoản thật) theo playerId, cho sơ đồ đội hình. */
  readonly playerNames = computed<ReadonlyMap<string, string>>(() => new Map([...this.users()]
    .map(([id, user]) => [id, user.fullName || user.email || ''] as [string, string])
    .filter(([, name]) => !!name)));

  /** Lịch theo ngày, trong ngày theo giờ; trận chưa có sân/giờ đứng cuối. */
  readonly matchDays = computed<MatchDay[]>(() => {
    const byDate = new Map<string, TournamentFixtureModel[]>();
    const unscheduled: TournamentFixtureModel[] = [];
    for (const fixture of this.fixtures()) {
      const when = this.slotOf(fixture);
      if (!when) { if (!this.isBye(fixture)) unscheduled.push(fixture); continue; }
      byDate.set(when.playDate, [...(byDate.get(when.playDate) ?? []), fixture]);
    }
    const days: MatchDay[] = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, fixtures]) => ({
      date, label: dayLabel(date),
      fixtures: fixtures.sort((a, b) => (this.slotOf(a)?.startTime ?? '').localeCompare(this.slotOf(b)?.startTime ?? '')
        || a.matchNumber - b.matchNumber)
    }));
    if (unscheduled.length) days.push({ date: null, label: 'Chưa xếp lịch', fixtures: unscheduled });
    return days;
  });

  /** Phong độ 5 trận gần nhất của mỗi đội (mới nhất ở cuối), tính từ các trận đã có kết quả. */
  readonly form = computed<ReadonlyMap<string, FormResult[]>>(() => {
    const played = this.fixtures()
      .filter(item => item.status === 'COMPLETED' && item.registration1Id && item.registration2Id)
      .sort((a, b) => this.playedKey(a).localeCompare(this.playedKey(b)));
    const result = new Map<string, FormResult[]>();
    const push = (id: string, value: FormResult) => result.set(id, [...(result.get(id) ?? []), value].slice(-5));
    for (const fixture of played) {
      const [a, b] = [fixture.score1 ?? 0, fixture.score2 ?? 0];
      push(fixture.registration1Id!, a > b ? 'W' : a < b ? 'L' : 'D');
      push(fixture.registration2Id!, b > a ? 'W' : b < a ? 'L' : 'D');
    }
    return result;
  });

  readonly names = computed<ReadonlyMap<string, string>>(() =>
    new Map(this.teams().map(item => [item.registrationId, this.teamName(item)])));
  readonly canRegister = computed(() => this.status() === 'REGISTRATION_OPEN' && !this.isHolding()
    && (this.tournament()?.currentParticipants ?? 0) < (this.tournament()?.maxParticipants ?? 0));
  readonly seatsLeft = computed(() => Math.max(0,
    (this.tournament()?.maxParticipants ?? 0) - (this.tournament()?.currentParticipants ?? 0)));
  readonly tournamentCourts = computed(() => (this.tournament()?.courtIds ?? [])
    .map(id => this.courtNames().get(id)).filter((name): name is string => !!name));

  /** Nha vo dich: thang chung ket (loai truc tiep) hoac hang 1 bang xep hang (vong tron) khi giai da xong. */
  readonly champion = computed<string | null>(() => {
    const tournament = this.tournament();
    if (!tournament || tournament.status !== 'COMPLETED') return null;
    if (tournament.format === 'ROUND_ROBIN') {
      const top = this.standings().find(item => item.rank === 1);
      return top ? this.names().get(top.registrationId) ?? null : null;
    }
    const final = [...this.fixtures()].sort((a, b) => b.roundNumber - a.roundNumber)[0];
    return final?.winnerRegistrationId ? this.names().get(final.winnerRegistrationId) ?? null : null;
  });

  readonly timeline = computed<TimelineStep[]>(() => {
    const t = this.tournament();
    if (!t) return [];
    const today = isoDate(new Date());
    const steps = [
      { label: 'Mở đăng ký', date: t.registrationOpenDate },
      { label: 'Đóng đăng ký', date: t.registrationCloseDate },
      { label: 'Khai mạc', date: t.startDate },
      { label: 'Kết thúc', date: t.endDate }
    ];
    const current = steps.findIndex(step => step.date >= today);
    return steps.map((step, index) => ({
      ...step,
      state: t.status === 'COMPLETED' || (current === -1) || index < current ? 'done'
        : index === current ? 'current' : 'upcoming'
    }));
  });

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    if (this.tournamentId) this.load();
    else { this.error.set('Mã giải đấu không hợp lệ.'); this.loading.set(false); }
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.fetch().subscribe({
      next: () => this.loading.set(false),
      error: error => {
        this.loading.set(false);
        this.error.set(error?.status === 400 || error?.status === 404
          ? 'Giải đấu không tồn tại hoặc chưa được công bố.'
          : 'Không tải được giải đấu. Kiểm tra kết nối rồi thử lại.');
      }
    });
  }

  /** Tai lai du lieu sau thao tac ma khong hien lai skeleton ca trang. */
  refresh(): void {
    this.fetch().subscribe({ error: () => this.notify.error('Không tải lại được dữ liệu giải đấu.') });
  }

  setTab(tab: DetailTab): void { this.activeTab.set(tab); }

  slotOf(fixture: TournamentFixtureModel): TournamentReservationModel | undefined {
    return fixture.reservationId ? this.reservationById().get(fixture.reservationId) : undefined;
  }

  isBye(fixture: TournamentFixtureModel): boolean {
    return !!fixture.registration1Id && !fixture.registration2Id && fixture.status === 'COMPLETED';
  }

  sideName(id: string | undefined, fixture: TournamentFixtureModel): string {
    if (id) return this.names().get(id) ?? 'Đội tham dự';
    return fixture.roundNumber > 1 ? 'Chờ đội thắng' : 'Miễn thi đấu';
  }

  /** Luôn 5 ô: kết quả gần nhất ở cuối, ô trống khi đội chưa đá đủ 5 trận. */
  formSlots(registrationId: string): (FormResult | null)[] {
    const results = this.form().get(registrationId) ?? [];
    return [...results, ...Array<null>(5 - results.length).fill(null)];
  }

  private playedKey(fixture: TournamentFixtureModel): string {
    const when = this.slotOf(fixture);
    return `${when?.playDate ?? ''}|${when?.startTime ?? ''}|${String(fixture.roundNumber).padStart(3, '0')}|${String(fixture.matchNumber).padStart(3, '0')}`;
  }

  openRegister(): void {
    if (!this.auth.currentUser) {
      this.auth.notifyAuthenticationRequired('Vui lòng đăng nhập để đăng ký giải đấu.');
      return;
    }
    this.showRegister.set(true);
  }

  onRegistered(registration: TournamentRegistrationModel): void {
    this.showRegister.set(false);
    if (registration.status === 'PENDING_PAYMENT') { this.pay(registration); return; }
    this.notify.success(registration.status === 'PENDING_MEMBERS'
      ? 'Đã tạo đội và gửi lời mời. Đội giữ chỗ khi đủ người nhận lời.'
      : 'Đăng ký thành công. Chúc bạn thi đấu tốt!');
    this.refresh();
  }

  onInvited(): void {
    this.showInvite.set(false);
    this.notify.success('Đã gửi lời mời.');
    this.refresh();
  }

  /** So tien va nguoi nhan do server tinh; client chi mo trang thanh toan. */
  pay(registration: TournamentRegistrationModel): void {
    if (this.mutating()) return;
    this.mutating.set(true);
    this.repository.checkout(this.tournamentId, registration.registrationId).subscribe({
      next: checkout => {
        this.pendingPayment.save({ kind: 'TOURNAMENT', tournamentId: this.tournamentId,
          registrationId: registration.registrationId, paymentId: checkout.paymentId });
        if (!checkout.checkoutUrl) {
          this.mutating.set(false);
          this.notify.error('Cổng thanh toán không trả về liên kết thanh toán. Thử lại sau ít phút.');
          this.refresh();
          return;
        }
        window.location.href = checkout.checkoutUrl;
      },
      error: error => {
        this.mutating.set(false);
        this.notify.error(error?.error?.message ?? 'Không thể khởi tạo thanh toán lệ phí.');
        this.refresh();
      }
    });
  }

  askWithdraw(): void {
    const registration = this.myRegistration();
    if (!registration) return;
    const paid = registration.paymentStatus === 'SUCCEEDED';
    const team = this.isTeamEvent();
    this.confirm.set(this.isRegistrant() ? {
      title: team ? 'Rút đội khỏi giải?' : 'Rút khỏi giải?',
      message: (team ? 'Cả đội sẽ rời giải và suất được nhường cho người khác.' : 'Suất của bạn sẽ nhường cho người khác.')
        + (paid ? ` Lệ phí ${formatVnd(this.feeAmount())} được gửi yêu cầu hoàn tự động.` : ''),
      confirmLabel: team ? 'Rút đội' : 'Rút đăng ký',
      run: () => this.mutate(this.repository.cancelRegistration(this.tournamentId, registration.registrationId),
        paid ? 'Đã rút đăng ký, yêu cầu hoàn phí đã được gửi.' : 'Đã rút đăng ký.')
    } : {
      title: 'Rời đội?',
      message: `Bạn sẽ rời ${this.teamName(registration)}.`
        + (registration.status === 'CONFIRMED' || registration.status === 'PENDING_PAYMENT'
          ? ` Đội phải còn đủ ${this.tournament()?.rosterMin} người, nếu không bạn cần báo đội trưởng mời người thay trước.` : ''),
      confirmLabel: 'Rời đội',
      run: () => this.mutate(this.repository.removeMember(this.tournamentId, registration.registrationId, this.me!), 'Bạn đã rời đội.')
    });
  }

  askRemove(line: TournamentLineup): void {
    const registration = this.myRegistration();
    if (!registration) return;
    const name = this.memberName(line);
    this.confirm.set({
      title: line.memberStatus === 'INVITED' ? `Thu hồi lời mời ${name}?` : `Bỏ ${name} khỏi đội?`,
      message: 'Bạn có thể mời người khác thay vào chỗ này.',
      confirmLabel: line.memberStatus === 'INVITED' ? 'Thu hồi' : 'Bỏ khỏi đội',
      run: () => this.mutate(this.repository.removeMember(this.tournamentId, registration.registrationId, line.playerId),
        'Đã cập nhật đội hình.')
    });
  }

  runConfirm(): void {
    const state = this.confirm();
    if (state && !this.mutating()) state.run();
  }

  closeConfirm(): void { if (!this.mutating()) this.confirm.set(null); }

  teamName(registration: TournamentRegistrationModel): string {
    if (registration.teamName) return registration.teamName;
    if (registration.clubId) return this.clubNames().get(registration.clubId) ?? 'Câu lạc bộ';
    return this.displayName(registration.playerId ?? registration.registeredBy);
  }

  displayName(userId: string): string {
    const user = this.users().get(userId);
    return user?.fullName || user?.email || 'Người chơi';
  }

  memberName(line: TournamentLineup): string {
    const user = this.users().get(line.playerId);
    return user?.fullName || line.playerName || user?.email || 'Người chơi';
  }

  acceptedOf(registration: TournamentRegistrationModel): number {
    return (registration.lineups ?? []).filter(line => (line.memberStatus ?? 'ACCEPTED') === 'ACCEPTED').length;
  }

  private fetch(): Observable<void> {
    return forkJoin({
      tournament: this.repository.getTournamentDetails(this.tournamentId),
      teams: this.repository.getTournamentTeams(this.tournamentId),
      fixtures: this.repository.getFixtures(this.tournamentId),
      standings: this.repository.getStandings(this.tournamentId),
      rules: this.repository.getEligibilityRules(this.tournamentId),
      reservations: this.repository.getReservations(this.tournamentId).pipe(catchError(() => of([])))
    }).pipe(map(data => {
      this.tournament.set(data.tournament);
      this.teams.set(data.teams);
      this.fixtures.set(data.fixtures);
      this.standings.set(data.standings);
      this.eligibilityRules.set(data.rules);
      this.reservations.set(data.reservations);
      this.resolveNames();
    }));
  }

  private mutate(request: Observable<unknown>, success: string): void {
    if (this.mutating()) return;
    this.mutating.set(true);
    request.subscribe({
      next: () => {
        this.mutating.set(false);
        this.confirm.set(null);
        this.notify.success(success);
        this.refresh();
      },
      error: error => {
        this.mutating.set(false);
        this.notify.error(error?.error?.message ?? 'Không thể thực hiện thao tác.');
      }
    });
  }

  /** Ten nguoi, ten CLB va ten co so/san deu la tham chieu logic — tai song song, loi thi giu nhan mac dinh. */
  private resolveNames(): void {
    const tournament = this.tournament();
    if (!tournament) return;
    // Cầu thủ trong đội hình đã lưu tên lúc được mời; chỉ tra auth-service cho người chưa có tên
    // (đội trưởng, người đăng ký) — tra từng cầu thủ sẽ là vài chục request mỗi lần mở trang.
    const userIds = [tournament.organizerId, ...this.teams().flatMap(item =>
      [item.registeredBy, item.playerId, ...(item.lineups ?? []).filter(line => !line.playerName).map(line => line.playerId)])]
      .filter((id): id is string => !!id);
    this.directory.resolve(userIds).subscribe(users => this.users.set(users));

    const clubIds = [...new Set(this.teams().map(item => item.clubId).filter((id): id is string => !!id))]
      .filter(id => !this.clubNames().has(id));
    if (clubIds.length) {
      forkJoin(clubIds.map(id => this.clubs.getClubDetails(id).pipe(map(club => [id, club.name] as const),
        catchError(() => of(null))))).subscribe(entries => {
        const next = new Map(this.clubNames());
        entries.forEach(entry => { if (entry) next.set(entry[0], entry[1]); });
        this.clubNames.set(next);
      });
    }

    if (tournament.venueId && !this.venueName()) {
      this.venues.getVenueDetails(tournament.venueId).pipe(map(response => response.data), catchError(() => of(null)))
        .subscribe(venue => {
          if (!venue) return;
          this.venueName.set(venue.name);
          this.courtNames.set(new Map((venue.courts ?? []).map(court => [court.venueCourtId, court.name])));
        });
    }
  }
}
