import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, filter, forkJoin, map, of, take } from 'rxjs';
import {
  ClubRole,
  CreateClubPayload,
  MyClubMembership,
  SportType
} from '@application/dto/club/club.dto';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { AuthService } from '@presentation/services/auth.service';
import { NotificationService } from '@presentation/services/notification.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { ClubLocationDataService } from './club-location-data.service';
import { CLUB_SPORTS, DEFAULT_CLUB_BANNER, DEFAULT_CLUB_LOGO, sportLabel } from './club-view.model';

type ClubTab = 'ALL' | 'MANAGED' | 'MEMBER';
type ClubSort = 'NEWEST' | 'NAME' | 'MEMBERS';

@Component({
  selector: 'app-my-clubs',
  templateUrl: './my-clubs.component.html',
  styleUrls: ['./club-member-pages.scss', './my-clubs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class MyClubsComponent {
  private readonly repository = inject(ClubRepositoryPort);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);
  private readonly notifications = inject(NotificationService);
  private readonly locationData = inject(ClubLocationDataService);
  private readonly destroyRef = inject(DestroyRef);

  readonly defaultClubLogo = DEFAULT_CLUB_LOGO;
  readonly defaultClubBanner = DEFAULT_CLUB_BANNER;
  readonly sports = CLUB_SPORTS;
  readonly provinces = this.locationData.provinces;
  readonly memberships = signal<MyClubMembership[]>([]);
  readonly pendingRequestCounts = signal<Partial<Record<string, number>>>({});
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly isAuthenticated = signal(false);
  readonly keyword = signal('');
  readonly selectedTab = signal<ClubTab>('ALL');
  readonly selectedSport = signal<SportType | 'ALL'>('ALL');
  readonly selectedCity = signal<string | 'ALL'>('ALL');
  readonly selectedSort = signal<ClubSort>('NEWEST');
  readonly pageIndex = signal(0);
  readonly pageSize = 6;
  readonly showCreateModal = signal(false);
  readonly creating = signal(false);

  readonly managedCount = computed(() => this.memberships()
    .filter(item => item.role === 'OWNER' || item.role === 'ADMIN').length);
  readonly memberCount = computed(() => this.memberships().filter(item => item.role === 'MEMBER').length);
  readonly filteredMemberships = computed(() => {
    const query = this.keyword().trim().toLocaleLowerCase('vi');
    const filtered = this.memberships().filter(item => {
      const tabMatches = this.selectedTab() === 'ALL'
        || (this.selectedTab() === 'MANAGED' && (item.role === 'OWNER' || item.role === 'ADMIN'))
        || (this.selectedTab() === 'MEMBER' && item.role === 'MEMBER');
      const sportMatches = this.selectedSport() === 'ALL' || item.club.sportType === this.selectedSport();
      const cityMatches = this.selectedCity() === 'ALL' || item.club.city === this.selectedCity();
      const textMatches = !query || [item.club.name, item.club.location, item.club.city]
        .filter(Boolean)
        .some(value => value!.toLocaleLowerCase('vi').includes(query));
      return tabMatches && sportMatches && cityMatches && textMatches;
    });

    return filtered.sort((left, right) => {
      if (this.selectedSort() === 'NAME') return left.club.name.localeCompare(right.club.name, 'vi');
      if (this.selectedSort() === 'MEMBERS') return right.club.memberCount - left.club.memberCount;
      return this.createdAt(right) - this.createdAt(left);
    });
  });
  readonly pagedMemberships = computed(() => {
    const start = this.pageIndex() * this.pageSize;
    return this.filteredMemberships().slice(start, start + this.pageSize);
  });
  readonly hasToolbarFilters = computed(() => Boolean(this.keyword().trim())
    || this.selectedSport() !== 'ALL' || this.selectedCity() !== 'ALL');

  readonly emptyTitle = computed(() => {
    if (this.hasToolbarFilters()) return 'Không tìm thấy câu lạc bộ phù hợp';
    if (this.selectedTab() === 'MANAGED') return 'Bạn chưa quản lý câu lạc bộ nào';
    if (this.selectedTab() === 'MEMBER') return 'Bạn chưa tham gia câu lạc bộ nào';
    return 'Bạn chưa có câu lạc bộ nào';
  });
  readonly emptyDescription = computed(() => {
    if (this.hasToolbarFilters()) return 'Thử thay đổi từ khóa hoặc môn thể thao để xem kết quả khác.';
    if (this.selectedTab() === 'MANAGED') return 'Tạo câu lạc bộ của riêng bạn và bắt đầu xây dựng cộng đồng.';
    if (this.selectedTab() === 'MEMBER') return 'Khám phá một cộng đồng phù hợp với môn thể thao và lịch chơi của bạn.';
    return 'Tạo câu lạc bộ mới hoặc khám phá cộng đồng đang hoạt động trên GOAT Sports.';
  });
  readonly emptyActionLabel = computed(() => {
    if (this.hasToolbarFilters()) return 'Xóa bộ lọc';
    return this.selectedTab() === 'MANAGED' ? 'Tạo câu lạc bộ' : 'Khám phá câu lạc bộ';
  });

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
    this.auth.sessionReady$.pipe(filter(Boolean), take(1)).subscribe(() => {
      this.isAuthenticated.set(this.auth.isAuthenticated);
      if (this.auth.isAuthenticated) this.load();
      else this.loading.set(false);
    });

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
    this.repository.getMyClubs().subscribe({
      next: memberships => {
        this.memberships.set(memberships);
        this.loadPendingRequestCounts(memberships);
        this.ensureValidPage();
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Không thể tải danh sách câu lạc bộ của bạn. Vui lòng thử lại.');
        this.loading.set(false);
      }
    });
  }

  selectTab(tab: ClubTab): void { this.selectedTab.set(tab); this.pageIndex.set(0); }
  updateKeyword(value: string): void { this.keyword.set(value); this.pageIndex.set(0); }
  updateSport(value: string): void { this.selectedSport.set(value as SportType | 'ALL'); this.pageIndex.set(0); }
  updateSort(value: string): void { this.selectedSort.set(value as ClubSort); this.pageIndex.set(0); }
  updateCity(value: string): void { this.selectedCity.set(value); this.pageIndex.set(0); }
  changePage(page: number): void {
    this.pageIndex.set(page);
    document.getElementById('my-clubs-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  clearFilters(): void {
    this.keyword.set('');
    this.selectedSport.set('ALL');
    this.selectedCity.set('ALL');
    this.selectedTab.set('ALL');
    this.pageIndex.set(0);
  }
  login(): void { this.auth.redirectToLogin(window.location.href); }

  openClub(item: MyClubMembership): void { void this.router.navigate(['/clubs', item.club.clubId]); }
  openCreateModal(): void { this.showCreateModal.set(true); }
  closeCreateModal(): void { if (!this.creating()) this.showCreateModal.set(false); }

  createClub(): void {
    const name = this.createForm.name.trim();
    if (!name || this.creating()) return;
    const payload: CreateClubPayload = {
      ...this.createForm,
      name,
      description: this.createForm.description?.trim() || undefined,
      city: this.createForm.city?.trim() || undefined,
      location: this.createForm.location?.trim() || undefined
    };
    this.creating.set(true);
    this.repository.createClub(payload).subscribe({
      next: club => {
        this.creating.set(false);
        this.showCreateModal.set(false);
        this.resetCreateForm();
        this.notify.success(`Đã tạo câu lạc bộ ${club.name}.`);
        this.load();
      },
      error: error => {
        this.creating.set(false);
        this.notify.error(error?.error?.message ?? 'Không tạo được câu lạc bộ.');
      }
    });
  }

  handleEmptyAction(): void {
    if (this.hasToolbarFilters()) {
      this.clearFilters();
    } else if (this.selectedTab() === 'MANAGED') {
      this.openCreateModal();
    } else {
      void this.router.navigate(['/clubs/explore']);
    }
  }

  roleLabel(role: ClubRole): string {
    return role === 'OWNER' ? 'Chủ CLB' : role === 'ADMIN' ? 'Quản lý CLB' : 'Thành viên';
  }

  private createdAt(item: MyClubMembership): number {
    return item.club.createdAt ? new Date(item.club.createdAt).getTime() : 0;
  }

  private ensureValidPage(): void {
    const maxPage = Math.max(0, Math.ceil(this.filteredMemberships().length / this.pageSize) - 1);
    if (this.pageIndex() > maxPage) this.pageIndex.set(maxPage);
  }

  sportName(value: SportType): string { return sportLabel(value); }

  private loadPendingRequestCounts(memberships: MyClubMembership[]): void {
    const managedMemberships = memberships.filter(item => item.role === 'OWNER' || item.role === 'ADMIN');
    if (!managedMemberships.length) {
      this.pendingRequestCounts.set({});
      return;
    }

    forkJoin(managedMemberships.map(item => this.repository.getClubMembers(item.club.clubId).pipe(
      map(members => [item.club.clubId, members.filter(member => member.status === 'PENDING').length] as const),
      catchError(() => of([item.club.clubId, 0] as const))
    ))).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(entries => {
      this.pendingRequestCounts.set(Object.fromEntries(entries));
    });
  }

  private resetCreateForm(): void {
    this.createForm = {
      name: '', description: '', sportType: 'BADMINTON', privacy: 'PUBLIC',
      approvalMode: 'AUTO', city: '', location: '', tags: []
    };
  }
}
