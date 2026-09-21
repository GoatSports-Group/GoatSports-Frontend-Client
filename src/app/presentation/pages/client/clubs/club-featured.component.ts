import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SportType } from '@application/dto/club/club.dto';
import { ClubLocationDataService } from './club-location-data.service';
import { ClubBrowseService } from './club-browse.service';
import {
  CLUB_SPORTS,
  ClubCardView,
  DEFAULT_CLUB_BANNER,
  DEFAULT_CLUB_LOGO,
  sportLabel
} from './club-view.model';

@Component({
  selector: 'app-club-featured',
  templateUrl: './club-featured.component.html',
  styleUrls: ['./club-featured.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class ClubFeaturedComponent {
  private readonly router = inject(Router);
  private readonly locationData = inject(ClubLocationDataService);
  private readonly browse = inject(ClubBrowseService);

  readonly defaultClubLogo = DEFAULT_CLUB_LOGO;
  readonly defaultClubBanner = DEFAULT_CLUB_BANNER;
  readonly sports = CLUB_SPORTS;
  readonly clubs = this.browse.clubs;
  readonly loading = this.browse.loading;
  readonly error = this.browse.error;
  readonly selectedSport = signal<SportType | 'ALL'>('ALL');
  readonly selectedCity = signal<string | 'ALL'>('ALL');
  readonly pageIndex = signal(0);
  readonly pageSize = 6;
  readonly requestClub = signal<ClubCardView | null>(null);
  readonly requestSubmitting = this.browse.mutating;
  readonly provinces = this.locationData.provinces;

  constructor() {
    this.reload();
  }

  /** "Nổi bật" xếp theo tỷ lệ thắng thật, không theo cờ featured gán tay. */
  readonly filteredClubs = computed(() =>
    [...this.clubs()].sort((left, right) => right.winRate - left.winRate));

  readonly pagedClubs = computed(() => {
    const start = this.pageIndex() * this.pageSize;
    return this.filteredClubs().slice(start, start + this.pageSize);
  });

  selectSport(value: string): void {
    this.selectedSport.set(value as SportType | 'ALL');
    this.pageIndex.set(0);
    this.reload();
  }

  updateCity(value: string): void {
    this.selectedCity.set(value);
    this.pageIndex.set(0);
    this.reload();
  }

  clearFilters(): void {
    this.selectedSport.set('ALL');
    this.selectedCity.set('ALL');
    this.pageIndex.set(0);
    this.reload();
  }

  changePage(page: number): void {
    this.pageIndex.set(page);
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  sportLabel(value: SportType): string { return sportLabel(value); }

  goToClub(club: ClubCardView): void { void this.router.navigate(['/clubs', club.clubId]); }
  goToClubFromKeyboard(event: Event, club: ClubCardView): void { event.preventDefault(); this.goToClub(club); }

  handleClubAction(event: Event, club: ClubCardView): void {
    event.stopPropagation();
    if (club.action === 'PENDING' || club.action === 'DETAIL') return;
    if (club.action === 'REQUEST') {
      this.requestClub.set(club);
      return;
    }
    this.browse.join(club, () => this.reload());
  }

  closeJoinRequest(): void { this.requestClub.set(null); }

  submitJoinRequest(message: string): void {
    const club = this.requestClub();
    if (club) this.browse.join(club, () => { this.requestClub.set(null); this.reload(); }, message);
  }

  useLogoFallback(event: Event): void { this.applyImageFallback(event, this.defaultClubLogo); }
  useBannerFallback(event: Event): void { this.applyImageFallback(event, this.defaultClubBanner); }

  private reload(): void {
    const sport = this.selectedSport();
    const city = this.selectedCity();
    this.browse.load(sport === 'ALL' ? undefined : sport, city === 'ALL' ? undefined : city);
  }

  private applyImageFallback(event: Event, fallback: string): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(fallback)) image.src = fallback;
  }
}
