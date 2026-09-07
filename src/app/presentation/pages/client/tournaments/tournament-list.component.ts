import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import { SportType } from '@application/dto/club/club.dto';
import { CreateTournamentPayload, Tournament as TournamentModel } from '@application/dto/tournament/tournament.dto';
import { AuthService } from '@presentation/services/auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';

@Component({
  selector: 'app-tournament-list', templateUrl: './tournament-list.component.html',
  styleUrls: ['./tournament-list.component.scss'], changeDetection: ChangeDetectionStrategy.OnPush, standalone: false
})
export class TournamentListComponent {
  private readonly repository = inject(TournamentRepositoryPort);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);

  readonly tournaments = signal<TournamentModel[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedSport = signal<SportType | 'ALL'>('ALL');
  readonly keyword = signal('');
  readonly showCreateModal = signal(false);
  readonly sports: ReadonlyArray<{ label: string; value: SportType | 'ALL' }> = [
    { label: 'Tất cả', value: 'ALL' }, { label: 'Cầu lông', value: 'BADMINTON' },
    { label: 'Bóng đá', value: 'FOOTBALL' }, { label: 'Pickleball', value: 'PICKLEBALL' },
    { label: 'Tennis', value: 'TENNIS' }, { label: 'Bóng rổ', value: 'BASKETBALL' },
    { label: 'Bóng chuyền', value: 'VOLLEYBALL' }
  ];
  createForm: CreateTournamentPayload = this.defaultForm();

  constructor() { this.load(); }
  load(): void {
    this.loading.set(true); this.error.set(null);
    const selected = this.selectedSport();
    const sport: SportType | undefined = selected === 'ALL' ? undefined : selected;
    this.repository.searchTournaments(sport, undefined, this.keyword()).subscribe({
      next: tournaments => { this.tournaments.set(tournaments); this.loading.set(false); },
      error: () => { this.error.set('Không thể tải danh sách giải đấu.'); this.loading.set(false); }
    });
  }
  selectSport(value: SportType | 'ALL'): void { this.selectedSport.set(value); this.load(); }
  updateKeyword(value: string): void { this.keyword.set(value); }
  goToDetail(id: string): void { void this.router.navigate(['/tournaments', id]); }
  openCreateModal(): void { if (!this.auth.currentUser) { this.auth.redirectToLogin(); return; } this.showCreateModal.set(true); }
  closeCreateModal(): void { if (!this.saving()) this.showCreateModal.set(false); }
  createTournament(): void {
    if (!this.createForm.name.trim() || this.saving()) return;
    this.saving.set(true);
    this.repository.createTournament({ ...this.createForm, name: this.createForm.name.trim() }).subscribe({
      next: tournament => { this.saving.set(false); this.showCreateModal.set(false); this.notify.success('Đã tạo giải đấu.');
        void this.router.navigate(['/tournaments', tournament.tournamentId]); },
      error: error => { this.saving.set(false); this.notify.error(error?.error?.message ?? 'Không thể tạo giải đấu.'); }
    });
  }
  statusLabel(status: TournamentModel['status']): string {
    return ({ DRAFT: 'Bản nháp', PUBLISHED: 'Đã công bố', REGISTRATION_OPEN: 'Đang mở đăng ký',
      REGISTRATION_CLOSED: 'Đã đóng đăng ký', IN_PROGRESS: 'Đang diễn ra', COMPLETED: 'Đã kết thúc', CANCELLED: 'Đã hủy' })[status];
  }
  private defaultForm(): CreateTournamentPayload {
    const day = 86_400_000; const now = Date.now(); const date = (offset: number) => new Date(now + offset * day).toISOString().slice(0, 10);
    return { name: '', description: '', sportType: 'BADMINTON', format: 'SINGLE_ELIMINATION', maxParticipants: 16,
      entryFee: 0, prizePool: 0, registrationOpenDate: date(0), registrationCloseDate: date(7),
      startDate: date(8), endDate: date(9), rules: [] };
  }
}
