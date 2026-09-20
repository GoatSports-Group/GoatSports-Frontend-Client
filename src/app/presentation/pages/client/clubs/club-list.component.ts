import { AfterViewInit, ChangeDetectionStrategy, Component, computed, ElementRef, inject, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { Club as ClubModel, ClubActivity, CreateClubPayload, SportType } from '@application/dto/club/club.dto';
import { AuthService } from '@presentation/services/auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import gsap from 'gsap';

interface ClubActivityView {
  club: ClubModel;
  activity: ClubActivity;
}

type ClubSortMode = 'RELEVANCE' | 'MEMBERS' | 'WIN_RATE';
type ClubViewMode = 'GRID' | 'LIST';

@Component({
  selector: 'app-club-list',
  templateUrl: './club-list.component.html',
  styleUrls: ['./club-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class ClubListComponent implements AfterViewInit, OnDestroy {
  private readonly repository = inject(ClubRepositoryPort);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private animationContext?: ReturnType<typeof gsap.context>;

  readonly clubs = signal<ClubModel[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedSport = signal<SportType | 'ALL'>('ALL');
  readonly keyword = signal('');
  readonly sortMode = signal<ClubSortMode>('RELEVANCE');
  readonly viewMode = signal<ClubViewMode>('GRID');
  readonly showCreateModal = signal(false);
  readonly myClubs = signal<ClubModel[]>([]);
  readonly pendingClubs = signal<ClubModel[]>([]);
  readonly upcomingActivities = signal<ClubActivityView[]>([]);
  readonly sports: ReadonlyArray<{ label: string; value: SportType | 'ALL'; icon: string }> = [
    { label: 'Tất cả', value: 'ALL', icon: 'layout-grid' },
    { label: 'Bóng đá', value: 'FOOTBALL', icon: 'circle-dot' },
    { label: 'Bóng rổ', value: 'BASKETBALL', icon: 'circle-dot-dashed' },
    { label: 'Cầu lông', value: 'BADMINTON', icon: 'target' },
    { label: 'Tennis', value: 'TENNIS', icon: 'circle' },
    { label: 'Pickleball', value: 'PICKLEBALL', icon: 'swords' },
    { label: 'Bóng chuyền', value: 'VOLLEYBALL', icon: 'circle-dot' }
  ];
  readonly featuredClub = computed(() => this.clubs()[0] ?? null);
  readonly discoveryClubs = computed(() => {
    const clubs = this.clubs().slice(1);
    switch (this.sortMode()) {
      case 'MEMBERS': return clubs.sort((left, right) => right.memberCount - left.memberCount);
      case 'WIN_RATE': return clubs.sort((left, right) => right.winRate - left.winRate);
      default: return clubs;
    }
  });
  createForm: CreateClubPayload = {
    name: '', description: '', sportType: 'BADMINTON', privacy: 'PUBLIC', approvalMode: 'AUTO'
  };

  constructor() { this.load(); }

  ngAfterViewInit(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.animationContext = gsap.context(() => {
      gsap.from('.club-hero__copy > *, .club-hero__action > *', {
        y: 18, opacity: 0, duration: 0.58, stagger: 0.07, ease: 'power3.out'
      });
      gsap.from('.club-hero__media', { scale: 0.94, opacity: 0.35, duration: 0.9, ease: 'power3.out' });
      gsap.from('.sport-nav button', { y: 10, opacity: 0, duration: 0.42, stagger: 0.035, delay: 0.18, ease: 'power2.out' });
      gsap.from('.club-layout > *', { y: 16, opacity: 0, duration: 0.55, stagger: 0.08, delay: 0.28, ease: 'power2.out' });
    }, this.elementRef.nativeElement);
  }

  ngOnDestroy(): void { this.animationContext?.revert(); }

  load(): void {
    this.loading.set(true); this.error.set(null);
    const selected = this.selectedSport();
    const sport: SportType | undefined = selected === 'ALL' ? undefined : selected;
    this.repository.searchClubs(sport, this.keyword()).subscribe({
      next: clubs => {
        this.clubs.set(clubs);
        this.loading.set(false);
        this.loadCommunityContext(clubs);
      },
      error: () => { this.error.set('Không thể tải danh sách câu lạc bộ.'); this.loading.set(false); }
    });
  }
  selectSport(sport: SportType | 'ALL'): void { this.selectedSport.set(sport); this.load(); }
  updateKeyword(value: string): void { this.keyword.set(value); }
  updateSortMode(value: string): void { this.sortMode.set(value as ClubSortMode); }
  setViewMode(value: ClubViewMode): void { this.viewMode.set(value); }
  goToDetail(clubId: string): void { void this.router.navigate(['/clubs', clubId]); }
  openCreateModal(): void {
    if (!this.auth.currentUser) {
      this.auth.notifyAuthenticationRequired('Vui lòng đăng nhập để tạo câu lạc bộ.');
      return;
    }
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
  sportLabel(value: SportType): string { return this.sports.find(sport => sport.value === value)?.label ?? value; }
  cardActionLabel(club: ClubModel): string {
    if (this.pendingClubs().some(item => item.clubId === club.clubId)) return 'Đang chờ';
    if (this.myClubs().some(item => item.clubId === club.clubId)) return 'Xem chi tiết';
    return club.privacy === 'PRIVATE' ? 'Gửi yêu cầu' : 'Tham gia';
  }
  coverClass(club: ClubModel): string { return `cover-${club.sportType.toLowerCase()}`; }

  private loadCommunityContext(clubs: ClubModel[]): void {
    if (!this.auth.currentUser || !clubs.length) {
      this.myClubs.set([]);
      this.pendingClubs.set([]);
      this.upcomingActivities.set([]);
      return;
    }

    forkJoin(clubs.map(club => this.repository.getMyMembership(club.clubId).pipe(
      map(membership => ({ club, membership })),
      catchError(() => of({ club, membership: null }))
    ))).pipe(
      switchMap(items => {
        const activeClubs = items.filter(item => item.membership?.status === 'ACTIVE').map(item => item.club);
        const pendingClubs = items.filter(item => item.membership?.status === 'PENDING').map(item => item.club);
        this.myClubs.set(activeClubs);
        this.pendingClubs.set(pendingClubs);
        if (!activeClubs.length) return of([] as ClubActivityView[]);
        return forkJoin(activeClubs.map(club => this.repository.getClubActivities(club.clubId).pipe(
          map(activities => activities.map(activity => ({ club, activity }))),
          catchError(() => of([] as ClubActivityView[]))
        ))).pipe(map(groups => groups.flat()));
      })
    ).subscribe(items => {
      const now = Date.now();
      this.upcomingActivities.set(items
        .filter(item => new Date(item.activity.endAt).getTime() >= now)
        .sort((left, right) => new Date(left.activity.startAt).getTime() - new Date(right.activity.startAt).getTime())
        .slice(0, 4));
    });
  }
}
