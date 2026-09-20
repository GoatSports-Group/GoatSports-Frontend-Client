import { AfterViewInit, ChangeDetectionStrategy, Component, computed, ElementRef, inject, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Club, CreateClubPayload, MyClubMembership, SportType } from '@application/dto/club/club.dto';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { NotifyService } from '@shared/components/notify/notify.service';
import gsap from 'gsap';
import { ClubLocationDataService } from './club-location-data.service';
import {
  ActivityView,
  CLUB_SPORTS,
  ClubCardView,
  ClubSortMode,
  DEFAULT_CLUB_BANNER,
  DEFAULT_CLUB_LOGO,
  sportLabel,
  toActivityView,
  toCardView
} from './club-view.model';

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
  private readonly repository = inject(ClubRepositoryPort);
  private readonly locationData = inject(ClubLocationDataService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private animationContext?: ReturnType<typeof gsap.context>;

  readonly defaultClubLogo = DEFAULT_CLUB_LOGO;
  readonly defaultClubBanner = DEFAULT_CLUB_BANNER;

  readonly clubs = signal<ClubCardView[]>([]);
  readonly myClubs = signal<ClubCardView[]>([]);
  readonly pendingRequests = signal<ClubCardView[]>([]);
  readonly upcomingActivities = signal<ActivityView[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly mutating = signal(false);

  readonly selectedSport = signal<SportType | 'ALL'>('ALL');
  readonly selectedCity = signal<string | 'ALL'>('ALL');
  readonly sortMode = signal<ClubSortMode>('RELEVANCE');
  readonly showCreateModal = signal(false);
  readonly requestClub = signal<ClubCardView | null>(null);
  readonly sports = CLUB_SPORTS;
  readonly provinces = this.locationData.provinces;

  /** Tư cách thành viên của tôi theo clubId, để mỗi thẻ biết hiện nút nào. */
  private memberships = new Map<string, MyClubMembership>();

  readonly sortedClubs = computed(() => {
    const clubs = [...this.clubs()];
    switch (this.sortMode()) {
      case 'MEMBERS': return clubs.sort((left, right) => right.memberCount - left.memberCount);
      case 'WIN_RATE': return clubs.sort((left, right) => right.winRate - left.winRate);
      // "Nổi bật trước": đông thành viên và có thành tích thì lên trước.
      default: return clubs.sort((left, right) =>
        (right.memberCount * 2 + right.winRate) - (left.memberCount * 2 + left.winRate));
    }
  });

  readonly featuredClub = computed(() => this.sortedClubs()[0] ?? null);
  readonly discoveryClubs = computed(() => {
    const featured = this.featuredClub();
    return this.sortedClubs().filter(club => club.clubId !== featured?.clubId).slice(0, 5);
  });
  readonly totalClubs = computed(() => this.clubs().length);

  createForm: CreateClubPayload = {
    name: '',
    description: '',
    sportType: 'BADMINTON',
    privacy: 'PUBLIC',
    approvalMode: 'AUTO',
    city: '',
    location: ''
  };

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const sport = this.selectedSport();
    const city = this.selectedCity();
    forkJoin({
      clubs: this.repository.searchClubs(
        sport === 'ALL' ? undefined : sport,
        undefined,
        city === 'ALL' ? undefined : city),
      mine: this.repository.getMyClubs(),
      pending: this.repository.getMyPendingRequests(),
      activities: this.repository.getMyUpcomingActivities(5)
    }).subscribe({
      next: data => {
        this.memberships = new Map(
          [...data.mine, ...data.pending].map(item => [item.club.clubId, item]));
        this.clubs.set(data.clubs.map(club => toCardView(club, this.memberships.get(club.clubId))));
        this.myClubs.set(data.mine.map(item => toCardView(item.club, item)));
        this.pendingRequests.set(data.pending.map(item => toCardView(item.club, item)));

        const clubNames = new Map(data.mine.map(item => [item.club.clubId, item.club.name]));
        this.upcomingActivities.set(data.activities.map(activity =>
          toActivityView(activity, clubNames.get(activity.clubId) ?? '')));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Không tải được danh sách câu lạc bộ. Vui lòng thử lại.');
        this.loading.set(false);
      }
    });
  }

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

  // Lọc chạy phía máy chủ nên đổi bộ lọc là tải lại, không lọc trên mảng đã tải.
  selectSport(value: string): void { this.selectedSport.set(value as SportType | 'ALL'); this.load(); }
  updateCity(value: string): void { this.selectedCity.set(value); this.load(); }
  updateSortMode(value: string): void { this.sortMode.set(value as ClubSortMode); }
  clearFilters(): void { this.selectedSport.set('ALL'); this.selectedCity.set('ALL'); this.load(); }
  openCreateModal(): void { this.showCreateModal.set(true); }
  closeCreateModal(): void { this.showCreateModal.set(false); }

  goToClub(club: ClubCardView): void {
    void this.router.navigate(['/clubs', club.clubId]);
  }

  goToClubFromKeyboard(event: Event, club: ClubCardView): void {
    event.preventDefault();
    this.goToClub(club);
  }

  createClub(): void {
    const name = this.createForm.name.trim();
    if (!name || this.mutating()) return;
    this.mutating.set(true);
    this.repository.createClub({ ...this.createForm, name }).subscribe({
      next: (club: Club) => {
        this.mutating.set(false);
        this.showCreateModal.set(false);
        this.createForm = {
          name: '', description: '', sportType: 'BADMINTON',
          privacy: 'PUBLIC', approvalMode: 'AUTO', city: '', location: ''
        };
        this.notify.success(`Đã tạo câu lạc bộ ${club.name}.`);
        this.load();
      },
      error: error => {
        this.mutating.set(false);
        this.notify.error(error?.error?.message ?? 'Không tạo được câu lạc bộ.');
      }
    });
  }

  handleClubAction(event: Event, club: ClubCardView): void {
    event.stopPropagation();
    if (club.action === 'PENDING' || club.action === 'DETAIL') return;
    if (club.action === 'REQUEST') {
      this.requestClub.set(club);
      return;
    }
    this.sendJoin(club);
  }

  closeJoinRequest(): void { this.requestClub.set(null); }

  submitJoinRequest(): void {
    const club = this.requestClub();
    if (club) this.sendJoin(club);
    this.requestClub.set(null);
  }

  /**
   * Một đường gửi duy nhất cho cả CLB tự duyệt lẫn CLB duyệt tay: backend tự quyết
   * vào thẳng hay chờ duyệt theo approvalMode, client không đoán thay.
   */
  private sendJoin(club: ClubCardView): void {
    if (this.mutating()) return;
    this.mutating.set(true);
    this.repository.joinClub(club.clubId).subscribe({
      next: member => {
        this.mutating.set(false);
        this.notify.success(member.status === 'ACTIVE'
          ? `Đã tham gia ${club.name}.`
          : `Đã gửi yêu cầu tham gia ${club.name}, chờ ban quản trị duyệt.`);
        this.load();
      },
      error: error => {
        this.mutating.set(false);
        this.notify.error(error?.error?.message ?? 'Không gửi được yêu cầu tham gia.');
      }
    });
  }

  comingSoon(): void {
    this.notify.info('Chức năng đang phát triển.');
  }

  sportLabel(value: SportType): string { return sportLabel(value); }

  useLogoFallback(event: Event): void { this.applyImageFallback(event, this.defaultClubLogo); }
  useBannerFallback(event: Event): void { this.applyImageFallback(event, this.defaultClubBanner); }

  private applyImageFallback(event: Event, fallback: string): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(fallback)) image.src = fallback;
  }
}
