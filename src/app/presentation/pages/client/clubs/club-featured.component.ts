import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { SportType } from '@application/dto/club/club.dto';
import { ClubLocationDataService } from './club-location-data.service';
import { ClubBrowseService } from './club-browse.service';
import { ClubFeaturedService, FeaturedClubView } from './club-featured.service';
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
  private readonly featured = inject(ClubFeaturedService);
  private readonly destroyRef = inject(DestroyRef);
  /** Mot trang CLB noi bat do club-service xep hang (cung thu tu voi the noi bat o trang Cau lac bo). */
  readonly clubs = signal<FeaturedClubView[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly paging = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedSport = signal<SportType | 'ALL'>('ALL');
  readonly selectedCity = signal<string | 'ALL'>('ALL');
  readonly pageIndex = signal(0);
  readonly pageSize = 6;
  readonly requestClub = signal<ClubCardView | null>(null);
  readonly requestSubmitting = this.browse.mutating;
  readonly provinces = this.locationData.provinces;
  readonly cityOptions = computed(() => [
    { value: 'ALL', label: 'Tất cả thành phố và tỉnh', icon: 'map' },
    ...this.provinces().map(province => ({ value: province.code, label: province.name, icon: 'map-pin' }))
  ]);

  constructor() {
    this.reload();
  }

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
    this.fetch(true);
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

  reload(): void {
    this.pageIndex.set(0);
    this.fetch(false);
  }

  /** Doi trang giu trang cu (lam mo) thay vi skeleton; doi bo loc thi dung skeleton (GOAT-DESIGN Pagination). */
  private fetch(keepCurrent: boolean): void {
    const sport = this.selectedSport();
    const city = this.selectedCity();
    (keepCurrent ? this.paging : this.loading).set(true);
    this.error.set(null);
    this.featured.load({
      filterSport: sport === 'ALL' ? undefined : sport,
      filterCity: city === 'ALL' ? undefined : city
    }, this.pageIndex(), this.pageSize).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.clubs.set(result.items);
        this.total.set(result.total);
        this.loading.set(false);
        this.paging.set(false);
        if (keepCurrent) window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      },
      error: () => {
        this.error.set('Không tải được câu lạc bộ nổi bật. Vui lòng thử lại.');
        this.loading.set(false);
        this.paging.set(false);
      }
    });
  }

  private applyImageFallback(event: Event, fallback: string): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(fallback)) image.src = fallback;
  }
}
