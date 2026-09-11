import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import { CreateTournamentFeeCheckoutUseCase } from '@application/usecase/payment/create-tournament-fee-checkout.usecase';
import { User } from '@application/dto/user/user.dto';
import {
  TournamentFixture as TournamentFixtureModel, Tournament as TournamentModel,
  TournamentRegistration as TournamentRegistrationModel, TournamentRegistrationPayload,
  TournamentStanding as TournamentStandingModel
} from '@application/dto/tournament/tournament.dto';
import { AuthService } from '@presentation/services/auth.service';
import { PlayerDirectoryService } from '@presentation/services/player-directory.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { PendingBookingPaymentService } from '@presentation/services/pending-booking-payment.service';

type TournamentTab = 'FIXTURES' | 'STANDINGS' | 'TEAMS';

@Component({
  selector: 'app-tournament-detail', templateUrl: './tournament-detail.component.html',
  styleUrls: ['./tournament-detail.component.scss'], changeDetection: ChangeDetectionStrategy.OnPush, standalone: false
})
export class TournamentDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly repository = inject(TournamentRepositoryPort);
  private readonly auth = inject(AuthService);
  private readonly directory = inject(PlayerDirectoryService);
  private readonly notify = inject(NotifyService);
  private readonly createFeeCheckout = inject(CreateTournamentFeeCheckoutUseCase);
  private readonly pendingPayment = inject(PendingBookingPaymentService);
  readonly tournamentId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly tournament = signal<TournamentModel | null>(null);
  readonly teams = signal<TournamentRegistrationModel[]>([]);
  readonly fixtures = signal<TournamentFixtureModel[]>([]);
  readonly standings = signal<TournamentStandingModel[]>([]);
  readonly users = signal<ReadonlyMap<string, User>>(new Map());
  readonly activeTab = signal<TournamentTab>('FIXTURES');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly mutating = signal(false);
  readonly showRegisterModal = signal(false);
  readonly showScoreModal = signal(false);
  readonly selectedFixture = signal<TournamentFixtureModel | null>(null);
  readonly isOrganizer = computed(() => this.tournament()?.organizerId === this.auth.currentUser?.userId);
  readonly myRegistration = computed(() => {
    const userId = this.auth.currentUser?.userId;
    return userId ? this.teams().find(item => item.registeredBy === userId && item.status !== 'CANCELLED') ?? null : null;
  });
  registrationForm: TournamentRegistrationPayload = { type: 'INDIVIDUAL', skillLevel: 'INTERMEDIATE', teamName: '' };
  score1 = 0;
  score2 = 0;

  constructor() { if (this.tournamentId) this.load(); else this.error.set('Mã giải đấu không hợp lệ.'); }
  load(): void {
    this.loading.set(true); this.error.set(null);
    forkJoin({ tournament: this.repository.getTournamentDetails(this.tournamentId),
      teams: this.repository.getTournamentTeams(this.tournamentId), fixtures: this.repository.getFixtures(this.tournamentId),
      standings: this.repository.getStandings(this.tournamentId) }).subscribe({
      next: data => { this.tournament.set(data.tournament); this.teams.set(data.teams); this.fixtures.set(data.fixtures);
        this.standings.set(data.standings); this.loading.set(false); this.resolveUsers(data.tournament, data.teams); },
      error: () => { this.error.set('Không thể tải thông tin giải đấu.'); this.loading.set(false); }
    });
  }
  setTab(tab: TournamentTab): void { this.activeTab.set(tab); }
  register(): void {
    if (!this.auth.currentUser) {
      this.auth.notifyAuthenticationRequired('Vui lòng đăng nhập để đăng ký giải đấu.');
      return;
    }
    if (this.registrationForm.type === 'CLUB' && !this.registrationForm.clubId) {
      this.notify.warning('Vui lòng nhập mã câu lạc bộ.'); return;
    }
    this.mutating.set(true);
    const payload: TournamentRegistrationPayload = { ...this.registrationForm,
      playerId: this.registrationForm.type === 'INDIVIDUAL' ? this.auth.currentUser.userId : undefined };
    this.repository.registerTeam(this.tournamentId, payload).subscribe({
      next: registration => { this.mutating.set(false); this.showRegisterModal.set(false);
        if (registration.status === 'PENDING_PAYMENT') this.payRegistration(registration);
        else { this.notify.success('Đăng ký giải đấu thành công.'); this.load(); } },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể đăng ký giải đấu.'); }
    });
  }
  payRegistration(registration: TournamentRegistrationModel): void {
    const tournament = this.tournament();
    if (!tournament || tournament.entryFee <= 0 || this.mutating()) return;
    this.mutating.set(true);
    this.createFeeCheckout.execute(registration.registrationId, tournament.name, tournament.entryFee).subscribe({
      next: checkout => {
        this.pendingPayment.save({ kind: 'TOURNAMENT', tournamentId: tournament.tournamentId,
          registrationId: registration.registrationId, paymentId: checkout.payment.paymentId });
        if (!checkout.attempt.checkoutUrl) {
          this.mutating.set(false); this.notify.error('Cổng thanh toán không trả về liên kết thanh toán.'); return;
        }
        window.location.href = checkout.attempt.checkoutUrl;
      },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể khởi tạo thanh toán lệ phí.'); }
    });
  }
  cancelRegistration(): void {
    const registration = this.myRegistration(); if (!registration || this.mutating()) return;
    this.mutating.set(true); this.repository.cancelRegistration(this.tournamentId, registration.registrationId).subscribe({
      next: () => { this.mutating.set(false); this.notify.success('Đã hủy đăng ký.'); this.load(); },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể hủy đăng ký.'); }
    });
  }
  generateFixtures(): void {
    this.mutating.set(true); this.repository.generateFixtures(this.tournamentId).subscribe({
      next: fixtures => { this.fixtures.set(fixtures); this.mutating.set(false); this.activeTab.set('FIXTURES'); this.notify.success('Đã tạo lịch thi đấu.'); },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể tạo lịch thi đấu.'); }
    });
  }
  openScore(fixture: TournamentFixtureModel): void {
    if (!this.isOrganizer() || !fixture.registration2Id) return;
    this.selectedFixture.set(fixture); this.score1 = fixture.score1 ?? 0; this.score2 = fixture.score2 ?? 0; this.showScoreModal.set(true);
  }
  saveScore(): void {
    const fixture = this.selectedFixture(); if (!fixture || this.mutating()) return;
    this.mutating.set(true); this.repository.updateFixtureResult(this.tournamentId, fixture.fixtureId,
      { score1: this.score1, score2: this.score2 }).subscribe({
      next: () => { this.mutating.set(false); this.showScoreModal.set(false); this.load(); this.notify.success('Đã cập nhật tỷ số.'); },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể cập nhật tỷ số.'); }
    });
  }
  registrationName(id?: string): string {
    if (!id) return 'Được miễn';
    const registration = this.teams().find(item => item.registrationId === id);
    return registration?.teamName || (registration ? this.displayName(registration.registeredBy) : 'Chưa xác định');
  }
  displayName(userId: string): string { return this.users().get(userId)?.fullName || this.users().get(userId)?.email || `Người dùng ${userId.slice(0, 8)}`; }
  statusLabel(status: TournamentModel['status']): string {
    return ({ DRAFT: 'Bản nháp', PUBLISHED: 'Đã công bố', REGISTRATION_OPEN: 'Đang mở đăng ký', REGISTRATION_CLOSED: 'Đã đóng đăng ký',
      IN_PROGRESS: 'Đang diễn ra', COMPLETED: 'Đã kết thúc', CANCELLED: 'Đã hủy' })[status];
  }
  private resolveUsers(tournament: TournamentModel, registrations: TournamentRegistrationModel[]): void {
    this.directory.resolve([tournament.organizerId, ...registrations.map(item => item.registeredBy)])
      .subscribe(users => this.users.set(users));
  }
}
