import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SportType } from '@application/dto/club/club.dto';
import { NotifyService } from '@shared/components/notify/notify.service';
import { ClubLocationDataService } from './club-location-data.service';
import {
  CLUB_SPORTS,
  ClubCity,
  DEFAULT_CLUB_BANNER,
  DEFAULT_CLUB_LOGO,
  MockClub,
  MOCK_CLUBS,
  sportLabel
} from './club-mock-data';

@Component({
  selector: 'app-club-featured',
  templateUrl: './club-featured.component.html',
  styleUrls: ['./club-featured.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class ClubFeaturedComponent {
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);
  private readonly locationData = inject(ClubLocationDataService);

  readonly defaultClubLogo = DEFAULT_CLUB_LOGO;
  readonly defaultClubBanner = DEFAULT_CLUB_BANNER;
  readonly sports = CLUB_SPORTS;
  readonly clubs = signal<MockClub[]>(MOCK_CLUBS);
  readonly selectedSport = signal<SportType | 'ALL'>('ALL');
  readonly selectedCity = signal<ClubCity | 'ALL'>('ALL');
  readonly pageIndex = signal(0);
  readonly pageSize = 6;
  readonly requestClub = signal<MockClub | null>(null);
  readonly provinces = this.locationData.provinces;

  readonly filteredClubs = computed(() => this.clubs()
    .filter(club => this.selectedSport() === 'ALL' || club.sportType === this.selectedSport())
    .filter(club => this.selectedCity() === 'ALL' || club.city === this.selectedCity())
    .sort((left, right) => right.winRate - left.winRate));

  readonly pagedClubs = computed(() => {
    const start = this.pageIndex() * this.pageSize;
    return this.filteredClubs().slice(start, start + this.pageSize);
  });

  selectSport(value: string): void { this.selectedSport.set(value as SportType | 'ALL'); this.pageIndex.set(0); }
  updateCity(value: string): void { this.selectedCity.set(value as ClubCity | 'ALL'); this.pageIndex.set(0); }
  clearFilters(): void { this.selectedSport.set('ALL'); this.selectedCity.set('ALL'); this.pageIndex.set(0); }
  changePage(page: number): void {
    this.pageIndex.set(page);
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  sportLabel(value: SportType): string { return sportLabel(value); }

  goToClub(club: MockClub): void { void this.router.navigate(['/clubs', club.clubId]); }
  goToClubFromKeyboard(event: Event, club: MockClub): void { event.preventDefault(); this.goToClub(club); }

  handleClubAction(event: Event, club: MockClub): void {
    event.stopPropagation();
    if (club.action !== 'JOIN' && club.action !== 'REQUEST') return;

    if (club.privacy === 'PRIVATE') {
      this.requestClub.set(club);
      return;
    }

    this.clubs.update(clubs => clubs.map(item => item.clubId === club.clubId ? { ...item, action: 'DETAIL' } : item));
    this.notify.success(`Đã tham gia ${club.name} trong bản xem trước.`, 'Mock data');
  }

  closeJoinRequest(): void { this.requestClub.set(null); }

  submitJoinRequest(message: string): void {
    const club = this.requestClub();
    if (!club) return;
    this.clubs.update(clubs => clubs.map(item => item.clubId === club.clubId ? { ...item, action: 'PENDING' } : item));
    this.requestClub.set(null);
    this.notify.success(`Đã gửi lời giới thiệu ${message.length} ký tự đến ${club.name}.`, 'Mock data');
  }

  useLogoFallback(event: Event): void { this.applyImageFallback(event, this.defaultClubLogo); }
  useBannerFallback(event: Event): void { this.applyImageFallback(event, this.defaultClubBanner); }

  private applyImageFallback(event: Event, fallback: string): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(fallback)) image.src = fallback;
  }
}
