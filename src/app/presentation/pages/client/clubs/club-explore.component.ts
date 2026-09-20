import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SportType } from '@application/dto/club/club.dto';
import { NotifyService } from '@shared/components/notify/notify.service';
import { ClubLocationDataService } from './club-location-data.service';
import {
  CLUB_SPORTS,
  ClubCity,
  ClubSortMode,
  DEFAULT_CLUB_BANNER,
  DEFAULT_CLUB_LOGO,
  MockClub,
  MOCK_CLUBS,
  sportLabel
} from './club-mock-data';

@Component({
  selector: 'app-club-explore',
  templateUrl: './club-explore.component.html',
  styleUrls: ['./club-explore.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class ClubExploreComponent {
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);
  private readonly locationData = inject(ClubLocationDataService);

  readonly defaultClubLogo = DEFAULT_CLUB_LOGO;
  readonly defaultClubBanner = DEFAULT_CLUB_BANNER;
  readonly sports = CLUB_SPORTS;
  readonly provinces = this.locationData.provinces;
  readonly clubs = signal<MockClub[]>(MOCK_CLUBS.map(club => ({ ...club })));
  readonly selectedSport = signal<SportType | 'ALL'>('ALL');
  readonly selectedCity = signal<ClubCity | 'ALL'>('ALL');
  readonly sortMode = signal<ClubSortMode>('RELEVANCE');
  readonly pageIndex = signal(0);
  readonly pageSize = 6;
  readonly requestClub = signal<MockClub | null>(null);

  readonly filteredClubs = computed(() => {
    const selectedSport = this.selectedSport();
    const selectedCity = this.selectedCity();
    const clubs = this.clubs().filter(club =>
      (selectedSport === 'ALL' || club.sportType === selectedSport)
      && (selectedCity === 'ALL' || club.city === selectedCity)
    );

    switch (this.sortMode()) {
      case 'MEMBERS': return clubs.sort((left, right) => right.memberCount - left.memberCount);
      case 'WIN_RATE': return clubs.sort((left, right) => right.winRate - left.winRate);
      default: return clubs.sort((left, right) => Number(right.featured) - Number(left.featured));
    }
  });

  readonly pagedClubs = computed(() => {
    const start = this.pageIndex() * this.pageSize;
    return this.filteredClubs().slice(start, start + this.pageSize);
  });

  selectSport(value: string): void {
    this.selectedSport.set(value as SportType | 'ALL');
    this.pageIndex.set(0);
  }

  updateCity(value: string): void {
    this.selectedCity.set(value as ClubCity | 'ALL');
    this.pageIndex.set(0);
  }

  updateSortMode(value: string): void {
    this.sortMode.set(value as ClubSortMode);
    this.pageIndex.set(0);
  }

  clearFilters(): void {
    this.selectedSport.set('ALL');
    this.selectedCity.set('ALL');
    this.pageIndex.set(0);
  }

  changePage(page: number): void {
    this.pageIndex.set(page);
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  goToClub(club: MockClub): void { void this.router.navigate(['/clubs', club.clubId]); }

  handleClubAction(event: Event, club: MockClub): void {
    event.stopPropagation();
    if (club.action === 'PENDING' || club.action === 'DETAIL') return;
    if (club.privacy === 'PRIVATE') {
      this.requestClub.set(club);
      return;
    }
    this.updateAction(club.clubId, 'DETAIL');
    this.notify.success(`Đã tham gia ${club.name} trong bản xem trước.`, 'Mock data');
  }

  closeJoinRequest(): void { this.requestClub.set(null); }

  submitJoinRequest(message: string): void {
    const club = this.requestClub();
    if (!club) return;
    this.updateAction(club.clubId, 'PENDING');
    this.requestClub.set(null);
    this.notify.success(`Đã gửi lời giới thiệu ${message.length} ký tự đến ${club.name}.`, 'Mock data');
  }

  sportLabel(value: SportType): string { return sportLabel(value); }
  useLogoFallback(event: Event): void { this.applyImageFallback(event, this.defaultClubLogo); }
  useBannerFallback(event: Event): void { this.applyImageFallback(event, this.defaultClubBanner); }

  private updateAction(clubId: string, action: MockClub['action']): void {
    this.clubs.update(clubs => clubs.map(club => club.clubId === clubId ? { ...club, action } : club));
  }

  private applyImageFallback(event: Event, fallback: string): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(fallback)) image.src = fallback;
  }
}
