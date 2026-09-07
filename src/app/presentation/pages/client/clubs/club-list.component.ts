import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { Club as ClubModel, CreateClubPayload, SportType } from '@application/dto/club/club.dto';
import { AuthService } from '@presentation/services/auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';

@Component({
  selector: 'app-club-list',
  templateUrl: './club-list.component.html',
  styleUrls: ['./club-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class ClubListComponent {
  private readonly repository = inject(ClubRepositoryPort);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);

  readonly clubs = signal<ClubModel[]>([]);
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
  createForm: CreateClubPayload = {
    name: '', description: '', sportType: 'BADMINTON', privacy: 'PUBLIC', approvalMode: 'AUTO'
  };

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true); this.error.set(null);
    const selected = this.selectedSport();
    const sport: SportType | undefined = selected === 'ALL' ? undefined : selected;
    this.repository.searchClubs(sport, this.keyword()).subscribe({
      next: clubs => { this.clubs.set(clubs); this.loading.set(false); },
      error: () => { this.error.set('Không thể tải danh sách câu lạc bộ.'); this.loading.set(false); }
    });
  }
  selectSport(sport: SportType | 'ALL'): void { this.selectedSport.set(sport); this.load(); }
  updateKeyword(value: string): void { this.keyword.set(value); }
  goToDetail(clubId: string): void { void this.router.navigate(['/clubs', clubId]); }
  openCreateModal(): void {
    if (!this.auth.currentUser) { this.auth.redirectToLogin(); return; }
    this.showCreateModal.set(true);
  }
  closeCreateModal(): void { if (!this.saving()) this.showCreateModal.set(false); }
  createClub(): void {
    if (!this.createForm.name.trim() || this.saving()) return;
    this.saving.set(true);
    this.repository.createClub({ ...this.createForm, name: this.createForm.name.trim() }).subscribe({
      next: club => {
        this.saving.set(false); this.showCreateModal.set(false); this.notify.success('Đã tạo câu lạc bộ.');
        void this.router.navigate(['/clubs', club.clubId]);
      },
      error: error => { this.saving.set(false); this.notify.error(error?.error?.message ?? 'Không thể tạo câu lạc bộ.'); }
    });
  }
  initials(name: string): string { return name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
}
