import { AfterViewInit, ChangeDetectionStrategy, Component, computed, ElementRef, inject, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CreateClubPayload, SportType } from '@application/dto/club/club.dto';
import { NotifyService } from '@shared/components/notify/notify.service';
import gsap from 'gsap';
import { ClubLocationDataService } from './club-location-data.service';
import {
  CLUB_SPORTS,
  ClubCity,
  ClubSortMode,
  DEFAULT_CLUB_BANNER,
  DEFAULT_CLUB_LOGO,
  MockClub,
  MockInvitation,
  MOCK_ACTIVITIES,
  MOCK_CLUBS,
  MOCK_INVITATIONS,
  MOCK_MY_CLUBS,
  MOCK_OPEN_MATCHES,
  sportLabel
} from './club-mock-data';

@Component({
  selector: 'app-club-list',
  templateUrl: './club-list.component.html',
  styleUrls: ['./club-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class ClubListComponent implements AfterViewInit, OnDestroy {
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);
  private readonly locationData = inject(ClubLocationDataService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private animationContext?: ReturnType<typeof gsap.context>;

  readonly defaultClubLogo = DEFAULT_CLUB_LOGO;
  readonly defaultClubBanner = DEFAULT_CLUB_BANNER;
  readonly clubs = signal<MockClub[]>(MOCK_CLUBS);
  readonly myClubs = signal<MockClub[]>(MOCK_MY_CLUBS);
  readonly invitations = signal<MockInvitation[]>(MOCK_INVITATIONS);
  readonly upcomingActivities = signal(MOCK_ACTIVITIES);
  readonly openMatches = signal(MOCK_OPEN_MATCHES);
  readonly selectedSport = signal<SportType | 'ALL'>('ALL');
  readonly selectedCity = signal<ClubCity | 'ALL'>('ALL');
  readonly sortMode = signal<ClubSortMode>('RELEVANCE');
  readonly showCreateModal = signal(false);
  readonly requestClub = signal<MockClub | null>(null);
  readonly sports = CLUB_SPORTS;
  readonly provinces = this.locationData.provinces;

  readonly filteredClubs = computed(() => {
    const selectedSport = this.selectedSport();
    const selectedCity = this.selectedCity();
    const clubs = this.clubs().filter(club => {
      const matchesSport = selectedSport === 'ALL' || club.sportType === selectedSport;
      const matchesCity = selectedCity === 'ALL' || club.city === selectedCity;
      return matchesSport && matchesCity;
    });

    switch (this.sortMode()) {
      case 'MEMBERS': return clubs.sort((left, right) => right.memberCount - left.memberCount);
      case 'WIN_RATE': return clubs.sort((left, right) => right.winRate - left.winRate);
      default: return clubs.sort((left, right) => Number(right.featured) - Number(left.featured));
    }
  });

  readonly featuredClub = computed(() => this.filteredClubs().find(club => club.featured) ?? this.filteredClubs()[0] ?? null);
  readonly discoveryClubs = computed(() => {
    const featured = this.featuredClub();
    return this.filteredClubs().filter(club => club.clubId !== featured?.clubId).slice(0, 5);
  });

  createForm: CreateClubPayload = {
    name: '',
    description: '',
    sportType: 'BADMINTON',
    privacy: 'PUBLIC',
    approvalMode: 'AUTO'
  };

  ngAfterViewInit(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.animationContext = gsap.context(() => {
      gsap.from('.club-banner__content > *, .club-banner__action', { y: 16, opacity: 0, duration: 0.52, stagger: 0.06, ease: 'power3.out' });
      gsap.from('.club-banner__media', { scale: 1.035, opacity: 0.55, duration: 0.85, ease: 'power3.out' });
      gsap.from('.club-finder, .club-section, .rail-section', { y: 14, opacity: 0, duration: 0.46, stagger: 0.05, delay: 0.12, ease: 'power2.out' });
    }, this.elementRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.animationContext?.revert();
  }

  selectSport(value: string): void { this.selectedSport.set(value as SportType | 'ALL'); }
  updateCity(value: string): void { this.selectedCity.set(value as ClubCity | 'ALL'); }
  updateSortMode(value: string): void { this.sortMode.set(value as ClubSortMode); }
  clearFilters(): void { this.selectedSport.set('ALL'); this.selectedCity.set('ALL'); }
  openCreateModal(): void { this.showCreateModal.set(true); }
  closeCreateModal(): void { this.showCreateModal.set(false); }

  goToClub(club: MockClub): void {
    void this.router.navigate(['/clubs', club.clubId]);
  }

  goToClubFromKeyboard(event: Event, club: MockClub): void {
    event.preventDefault();
    this.goToClub(club);
  }

  createClub(): void {
    const name = this.createForm.name.trim();
    if (!name) return;

    const createdClub: MockClub = {
      clubId: `mock-created-${Date.now()}`,
      name,
      sportType: this.createForm.sportType,
      location: 'Địa điểm đang cập nhật',
      city: 'ho-chi-minh',
      description: this.createForm.description?.trim() || 'Câu lạc bộ mẫu vừa được tạo để xem trước giao diện.',
      memberCount: 1,
      winRate: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      privacy: this.createForm.privacy,
      activityLabel: 'CLB mới',
      schedule: 'Đang cập nhật lịch sinh hoạt',
      homeVenue: 'Đang cập nhật địa điểm',
      foundedYear: new Date().getFullYear(),
      logoUrl: null,
      bannerUrl: null,
      action: 'DETAIL'
    };

    this.clubs.update(clubs => [...clubs, createdClub]);
    this.myClubs.update(clubs => [createdClub, ...clubs]);
    this.createForm = { name: '', description: '', sportType: 'BADMINTON', privacy: 'PUBLIC', approvalMode: 'AUTO' };
    this.showCreateModal.set(false);
    this.notify.success('Đã thêm câu lạc bộ mẫu vào giao diện.', 'Mock data');
  }

  handleClubAction(event: Event, club: MockClub): void {
    event.stopPropagation();
    if (club.action === 'PENDING' || club.action === 'DETAIL') return;

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

  acceptInvitation(invitation: MockInvitation): void {
    this.invitations.update(items => items.filter(item => item.invitationId !== invitation.invitationId));
    this.myClubs.update(items => items.some(club => club.clubId === invitation.club.clubId) ? items : [...items, { ...invitation.club, action: 'DETAIL', activityLabel: 'Thành viên' }]);
    this.notify.success(`Đã chấp nhận lời mời từ ${invitation.club.name}.`, 'Mock data');
  }

  declineInvitation(invitation: MockInvitation): void {
    this.invitations.update(items => items.filter(item => item.invitationId !== invitation.invitationId));
    this.notify.info(`Đã ẩn lời mời từ ${invitation.club.name}.`, 'Mock data');
  }

  showMockNotice(message: string): void {
    this.notify.info(message, 'Mock data');
  }

  sportLabel(value: SportType): string { return sportLabel(value); }

  useLogoFallback(event: Event): void { this.applyImageFallback(event, this.defaultClubLogo); }
  useBannerFallback(event: Event): void { this.applyImageFallback(event, this.defaultClubBanner); }

  private applyImageFallback(event: Event, fallback: string): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(fallback)) image.src = fallback;
  }
}
