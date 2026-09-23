import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { filter, forkJoin, take } from 'rxjs';
import { Club, MyClubMembership, ScoutedPlayerModel, SportType } from '@application/dto/club/club.dto';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { AuthService } from '@presentation/services/auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { DEFAULT_CLUB_LOGO, sportLabel } from './club-view.model';

const RADIUS_OPTIONS = [10, 25, 50, 100, 200] as const;

@Component({
  selector: 'app-club-player-search',
  templateUrl: './club-player-search.component.html',
  styleUrls: ['./club-member-pages.scss', './club-player-search.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class ClubPlayerSearchComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly repository = inject(ClubRepositoryPort);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotifyService);

  readonly clubId = this.route.snapshot.paramMap.get('clubId') ?? '';
  readonly defaultClubLogo = DEFAULT_CLUB_LOGO;
  readonly radiusOptions = RADIUS_OPTIONS;
  readonly radiusSelectOptions = RADIUS_OPTIONS.map(radius => ({
    value: radius,
    label: `Trong ${radius} km`,
    icon: 'navigation'
  }));

  readonly club = signal<Club | null>(null);
  readonly membership = signal<MyClubMembership | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly isAuthenticated = signal(false);

  readonly candidates = signal<ReadonlyArray<ScoutedPlayerModel>>([]);
  readonly searching = signal(false);
  readonly searchError = signal<string | null>(null);
  readonly keyword = signal('');
  readonly radiusKm = signal<number>(25);
  readonly invitedIds = signal<ReadonlySet<string>>(new Set());
  readonly invitingId = signal<string | null>(null);
  readonly pageIndex = signal(0);
  readonly pageSize = 6;

  /** Backend inviteMember dung assertManager, nen quan ly CLB cung duoc tim va moi nguoi choi. */
  readonly isManager = computed(() => {
    const membership = this.membership();
    return membership?.status === 'ACTIVE'
      && (membership.role === 'OWNER' || membership.role === 'ADMIN');
  });

  readonly filteredPlayers = computed(() => {
    const query = this.keyword().trim().toLocaleLowerCase('vi');
    if (!query) return this.candidates();
    return this.candidates().filter(player =>
      [player.fullName, player.username].some(value => value.toLocaleLowerCase('vi').includes(query)));
  });

  readonly pagedPlayers = computed(() => {
    const start = this.pageIndex() * this.pageSize;
    return this.filteredPlayers().slice(start, start + this.pageSize);
  });

  constructor() {
    this.auth.sessionReady$.pipe(filter(Boolean), take(1)).subscribe(() => {
      this.isAuthenticated.set(this.auth.isAuthenticated);
      if (this.auth.isAuthenticated && this.clubId) this.load();
      else this.loading.set(false);
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      club: this.repository.getClubDetails(this.clubId),
      memberships: this.repository.getMyClubs()
    }).subscribe({
      next: ({ club, memberships }) => {
        this.club.set(club);
        this.membership.set(memberships.find(item => item.club.clubId === club.clubId) ?? null);
        this.loading.set(false);
        if (this.isManager()) this.search();
      },
      error: () => {
        this.error.set('Không thể tải thông tin câu lạc bộ để tìm người chơi.');
        this.loading.set(false);
      }
    });
  }

  search(): void {
    if (this.searching()) return;
    this.searching.set(true);
    this.searchError.set(null);
    this.repository.getScoutingCandidates(this.clubId, this.radiusKm()).subscribe({
      next: players => {
        this.candidates.set(players);
        this.pageIndex.set(0);
        this.searching.set(false);
      },
      error: error => {
        this.searching.set(false);
        this.searchError.set(error?.error?.message ?? 'Không tìm được người chơi phù hợp.');
      }
    });
  }

  updateKeyword(value: string): void {
    this.keyword.set(value);
    this.pageIndex.set(0);
  }

  updateRadius(value: string): void {
    this.radiusKm.set(Number(value));
    this.search();
  }

  changePage(page: number): void {
    this.pageIndex.set(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  invite(player: ScoutedPlayerModel): void {
    if (this.invitedIds().has(player.userId) || this.invitingId()) return;
    this.invitingId.set(player.userId);
    this.repository.inviteMember(this.clubId, player.userId).subscribe({
      next: () => {
        this.invitingId.set(null);
        this.invitedIds.update(current => new Set(current).add(player.userId));
        this.notify.success(`Đã gửi lời mời đến ${player.fullName}.`);
      },
      error: error => {
        this.invitingId.set(null);
        this.notify.error(error?.error?.message ?? `Không thể gửi lời mời đến ${player.fullName}.`);
      }
    });
  }

  clearFilters(): void {
    this.keyword.set('');
    this.pageIndex.set(0);
  }

  login(): void { this.auth.redirectToLogin(window.location.href); }
  sportLabel(value: SportType): string { return sportLabel(value); }

  skillLabel(value?: string): string {
    switch (value) {
      case 'BEGINNER': return 'Mới chơi';
      case 'INTERMEDIATE': return 'Trung bình';
      case 'ADVANCED': return 'Khá';
      case 'PRO': return 'Chuyên nghiệp';
      default: return 'Chưa rõ trình độ';
    }
  }

  initials(name: string): string {
    return name.trim().split(/\s+/).slice(-2).map(part => part.charAt(0).toUpperCase()).join('');
  }

  useLogoFallback(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(this.defaultClubLogo)) image.src = this.defaultClubLogo;
  }
}
