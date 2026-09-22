import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { filter, forkJoin, take } from 'rxjs';
import { Club, MyClubMembership, SportType } from '@application/dto/club/club.dto';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { AuthService } from '@presentation/services/auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { CLUB_PLAYER_MOCKS, ClubPlayerMock, PlayerAvailability } from './club-member.mock-data';
import { CLUB_SPORTS, DEFAULT_CLUB_LOGO, sportLabel } from './club-view.model';

type AvailabilityFilter = PlayerAvailability | 'ALL';

@Component({
  selector: 'app-club-player-search',
  templateUrl: './club-player-search.component.html',
  styleUrls: ['./club-member-pages.scss'],
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
  readonly sports = CLUB_SPORTS;
  readonly club = signal<Club | null>(null);
  readonly membership = signal<MyClubMembership | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly isAuthenticated = signal(false);
  readonly keyword = signal('');
  readonly selectedSport = signal<SportType | 'ALL'>('ALL');
  readonly selectedCity = signal('ALL');
  readonly selectedAvailability = signal<AvailabilityFilter>('ALL');
  readonly invitedIds = signal<ReadonlySet<string>>(new Set());
  readonly pageIndex = signal(0);
  readonly pageSize = 6;
  readonly cities = [...new Set(CLUB_PLAYER_MOCKS.map(player => player.city))];

  readonly isManager = computed(() => {
    const membership = this.membership();
    return membership?.status === 'ACTIVE'
      && (membership.role === 'OWNER' || membership.role === 'ADMIN');
  });
  readonly filteredPlayers = computed(() => {
    const query = this.keyword().trim().toLocaleLowerCase('vi');
    return CLUB_PLAYER_MOCKS.filter(player => {
      const textMatches = !query || [player.fullName, player.username, player.district, player.level]
        .some(value => value.toLocaleLowerCase('vi').includes(query));
      const sportMatches = this.selectedSport() === 'ALL' || player.sportType === this.selectedSport();
      const cityMatches = this.selectedCity() === 'ALL' || player.city === this.selectedCity();
      const availabilityMatches = this.selectedAvailability() === 'ALL' || player.availability === this.selectedAvailability();
      return textMatches && sportMatches && cityMatches && availabilityMatches;
    });
  });
  readonly pagedPlayers = computed(() => {
    const start = this.pageIndex() * this.pageSize;
    return this.filteredPlayers().slice(start, start + this.pageSize);
  });
  readonly hasFilters = computed(() => Boolean(this.keyword().trim()) || this.selectedSport() !== 'ALL' || this.selectedCity() !== 'ALL' || this.selectedAvailability() !== 'ALL');

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
    forkJoin({ club: this.repository.getClubDetails(this.clubId), memberships: this.repository.getMyClubs() }).subscribe({
      next: ({ club, memberships }) => {
        this.club.set(club);
        this.membership.set(memberships.find(item => item.club.clubId === club.clubId) ?? null);
        this.loading.set(false);
      },
      error: () => { this.error.set('Không thể tải thông tin câu lạc bộ để tìm người chơi.'); this.loading.set(false); }
    });
  }

  updateKeyword(value: string): void { this.keyword.set(value); this.pageIndex.set(0); }
  updateSport(value: string): void { this.selectedSport.set(value as SportType | 'ALL'); this.pageIndex.set(0); }
  updateCity(value: string): void { this.selectedCity.set(value); this.pageIndex.set(0); }
  updateAvailability(value: string): void { this.selectedAvailability.set(value as AvailabilityFilter); this.pageIndex.set(0); }
  changePage(page: number): void { this.pageIndex.set(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  login(): void { this.auth.redirectToLogin(window.location.href); }
  sportLabel(value: SportType): string { return sportLabel(value); }

  clearFilters(): void {
    this.keyword.set(''); this.selectedSport.set('ALL'); this.selectedCity.set('ALL');
    this.selectedAvailability.set('ALL'); this.pageIndex.set(0);
  }

  invite(player: ClubPlayerMock): void {
    if (this.invitedIds().has(player.userId)) return;
    this.invitedIds.update(current => new Set(current).add(player.userId));
    this.notify.success(`Đã gửi lời mời mẫu đến ${player.fullName}.`);
  }

  useLogoFallback(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(this.defaultClubLogo)) image.src = this.defaultClubLogo;
  }
}
