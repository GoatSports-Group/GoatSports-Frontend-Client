import { AfterViewInit, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, effect, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { filter, forkJoin } from 'rxjs';
import { Club, ClubInvitation, CreateClubPayload, MyClubMembership, SportType } from '@application/dto/club/club.dto';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { AuthService } from '@presentation/services/auth.service';
import { NotificationService } from '@presentation/services/notification.service';
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
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locationData = inject(ClubLocationDataService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private animationContext?: ReturnType<typeof gsap.context>;

  readonly defaultClubLogo = DEFAULT_CLUB_LOGO;
  readonly defaultClubBanner = DEFAULT_CLUB_BANNER;

  readonly clubs = signal<ClubCardView[]>([]);
  readonly myClubs = signal<ClubCardView[]>([]);
  readonly pendingRequests = signal<ClubCardView[]>([]);
  readonly upcomingActivities = signal<ActivityView[]>([]);
  readonly selectedActivity = signal<ActivityView | null>(null);
  readonly activityLoading = signal(false);
  readonly activityLoadError = signal(false);
  readonly activityHasMore = signal(true);
  readonly activityTotal = signal(0);
  readonly invitations = signal<ClubInvitation[]>([]);
  /** Ba khối bên phải chỉ có nghĩa khi biết bạn là ai, nên hỏi trước khi gọi API. */
  readonly signedIn = signal(false);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly mutating = signal(false);
  readonly creating = signal(false);

  readonly selectedSport = signal<SportType | 'ALL'>('ALL');
  readonly selectedCity = signal<string | 'ALL'>('ALL');
  readonly sortMode = signal<ClubSortMode>('RELEVANCE');
  readonly showCreateModal = signal(false);
  readonly requestClub = signal<ClubCardView | null>(null);
  readonly requestSubmitting = signal(false);
  readonly sports = CLUB_SPORTS;
  readonly provinces = this.locationData.provinces;

  /** Tư cách thành viên của tôi theo clubId, để mỗi thẻ biết hiện nút nào. */
  private memberships = new Map<string, MyClubMembership>();
  private clubNames = new Map<string, string>();
  private readonly activityLoadSentinel = viewChild<ElementRef<HTMLElement>>('activityLoadSentinel');
  private readonly activityPageSize = 3;
  private activityPage = 0;

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
    location: '',
    tags: []
  };

  constructor() {
    effect(onCleanup => {
      const sentinel = this.activityLoadSentinel()?.nativeElement;
      if (!sentinel || !this.signedIn() || this.loading()) return;
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) this.loadNextUpcomingActivities();
      }, { rootMargin: '100px 0px' });
      observer.observe(sentinel);
      onCleanup(() => observer.disconnect());
    });
    this.load();
    this.notifications.realtimeNotifications$
      .pipe(
        filter(notification => ['CLUB', 'CLUB_PUBLIC', 'CLUB_INVITATION', 'CLUB_DISBANDED']
          .includes(notification.referenceType ?? '')),
        takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.signedIn.set(this.auth.isAuthenticated);
    this.resetActivityPagination();

    const sport = this.selectedSport();
    const city = this.selectedCity();
    const search = this.repository.searchClubs(
      sport === 'ALL' ? undefined : sport,
      undefined,
      city === 'ALL' ? undefined : city);

    // Khách chưa đăng nhập vẫn xem được danh sách CLB; gọi /me lúc này chỉ tổ 401.
    if (!this.signedIn()) {
      this.memberships = new Map();
      this.myClubs.set([]);
      this.pendingRequests.set([]);
      this.invitations.set([]);
      this.upcomingActivities.set([]);
      search.subscribe({
        next: clubs => {
          this.clubs.set(clubs.map(club => toCardView(club)));
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Không tải được danh sách câu lạc bộ. Vui lòng thử lại.');
          this.loading.set(false);
        }
      });
      return;
    }

    forkJoin({
      clubs: search,
      mine: this.repository.getMyClubs(),
      pending: this.repository.getMyPendingRequests(),
      invitations: this.repository.getMyInvitations(),
      activities: this.repository.getMyUpcomingActivitiesPage(0, this.activityPageSize)
    }).subscribe({
      next: data => {
        this.memberships = new Map(
          [...data.mine, ...data.pending].map(item => [item.club.clubId, item]));
        this.clubs.set(data.clubs.map(club => toCardView(club, this.memberships.get(club.clubId))));
        this.myClubs.set(data.mine.map(item => toCardView(item.club, item)));
        this.pendingRequests.set(data.pending.map(item => toCardView(item.club, item)));
        this.invitations.set(data.invitations);

        this.clubNames = new Map(data.mine.map(item => [item.club.clubId, item.club.name]));
        this.upcomingActivities.set(data.activities.items.map(activity =>
          toActivityView(activity, this.clubNames.get(activity.clubId) ?? '')));
        this.activityTotal.set(data.activities.total);
        this.activityPage = 1;
        this.activityHasMore.set(this.activityPage < data.activities.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Không tải được danh sách câu lạc bộ. Vui lòng thử lại.');
        this.loading.set(false);
      }
    });
  }

  acceptInvitation(invitation: ClubInvitation): void {
    if (this.mutating()) return;
    this.mutating.set(true);
    this.repository.acceptInvitation(invitation.invitationId).subscribe({
      next: () => {
        this.mutating.set(false);
        this.notify.success(`Đã tham gia ${invitation.club.name}.`);
        this.load();
      },
      error: error => {
        this.mutating.set(false);
        this.notify.error(error?.error?.message ?? 'Không nhận được lời mời.');
      }
    });
  }

  declineInvitation(invitation: ClubInvitation): void {
    if (this.mutating()) return;
    this.mutating.set(true);
    this.repository.declineInvitation(invitation.invitationId).subscribe({
      next: () => {
        this.mutating.set(false);
        this.notify.info(`Đã từ chối lời mời từ ${invitation.club.name}.`);
        this.load();
      },
      error: error => {
        this.mutating.set(false);
        this.notify.error(error?.error?.message ?? 'Không từ chối được lời mời.');
      }
    });
  }

  goToLogin(): void {
    void this.router.navigate(['/login']);
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
  closeCreateModal(): void {
    if (this.creating()) return;
    this.showCreateModal.set(false);
  }

  loadNextUpcomingActivities(): void {
    if (this.activityLoading() || !this.activityHasMore() || !this.signedIn()) return;
    this.activityLoading.set(true);
    this.activityLoadError.set(false);
    const requestedPage = this.activityPage;
    this.repository.getMyUpcomingActivitiesPage(requestedPage, this.activityPageSize).subscribe({
      next: page => {
        const mapped = page.items.map(activity =>
          toActivityView(activity, this.clubNames.get(activity.clubId) ?? ''));
        this.upcomingActivities.update(items => {
          const known = new Set(items.map(item => item.activityId));
          return [...items, ...mapped.filter(item => !known.has(item.activityId))];
        });
        this.activityTotal.set(page.total);
        this.activityPage = requestedPage + 1;
        this.activityHasMore.set(this.activityPage < page.totalPages);
        this.activityLoading.set(false);
      },
      error: () => {
        this.activityLoading.set(false);
        this.activityLoadError.set(true);
      }
    });
  }

  openActivityDetails(activity: ActivityView): void { this.selectedActivity.set(activity); }
  closeActivityDetails(): void { this.selectedActivity.set(null); }

  private resetActivityPagination(): void {
    this.activityPage = 0;
    this.activityTotal.set(0);
    this.activityHasMore.set(true);
    this.activityLoadError.set(false);
  }

  goToClub(club: ClubCardView): void {
    void this.router.navigate(['/clubs', club.clubId]);
  }

  openMyClub(club: ClubCardView): void {
    void this.router.navigate(['/clubs', club.clubId]);
  }

  goToClubFromKeyboard(event: Event, club: ClubCardView): void {
    event.preventDefault();
    this.goToClub(club);
  }

  createClub(): void {
    const name = this.createForm.name.trim();
    if (!name || this.creating()) return;
    if (!this.signedIn()) {
      this.notify.info('Bạn cần đăng nhập để tạo câu lạc bộ.');
      return;
    }
    const payload: CreateClubPayload = {
      ...this.createForm,
      name,
      description: this.createForm.description?.trim() || undefined,
      city: this.createForm.city?.trim() || undefined,
      location: this.createForm.location?.trim() || undefined
    };
    this.creating.set(true);
    this.repository.createClub(payload).subscribe({
      next: (club: Club) => {
        this.creating.set(false);
        this.showCreateModal.set(false);
        this.createForm = {
          name: '', description: '', sportType: 'BADMINTON',
          privacy: 'PUBLIC', approvalMode: 'AUTO', city: '', location: '', tags: []
        };
        this.notify.success(`Đã tạo câu lạc bộ ${club.name}.`);
        this.load();
      },
      error: error => {
        this.creating.set(false);
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

  closeJoinRequest(): void {
    if (!this.requestSubmitting()) this.requestClub.set(null);
  }

  submitJoinRequest(message: string): void {
    const club = this.requestClub();
    if (club) this.sendJoin(club, message);
  }

  /**
   * Một đường gửi duy nhất cho cả CLB tự duyệt lẫn CLB duyệt tay: backend tự quyết
   * vào thẳng hay chờ duyệt theo approvalMode, client không đoán thay.
   */
  private sendJoin(club: ClubCardView, message?: string): void {
    if (this.mutating()) return;
    if (!this.signedIn()) {
      this.notify.info('Bạn cần đăng nhập để tham gia câu lạc bộ.');
      return;
    }
    this.mutating.set(true);
    this.requestSubmitting.set(Boolean(message));
    this.repository.joinClub(club.clubId, message).subscribe({
      next: member => {
        this.mutating.set(false);
        this.requestSubmitting.set(false);
        this.requestClub.set(null);
        this.notify.success(member.status === 'ACTIVE'
          ? `Đã tham gia ${club.name}.`
          : `Đã gửi yêu cầu tham gia ${club.name}, chờ ban quản trị duyệt.`);
        this.load();
      },
      error: error => {
        this.mutating.set(false);
        this.requestSubmitting.set(false);
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
