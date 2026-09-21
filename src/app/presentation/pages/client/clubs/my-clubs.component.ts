import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { filter, take } from 'rxjs';
import { ClubRole, MyClubMembership, SportType } from '@application/dto/club/club.dto';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { AuthService } from '@presentation/services/auth.service';
import { CLUB_SPORTS, DEFAULT_CLUB_BANNER, DEFAULT_CLUB_LOGO, sportLabel } from './club-view.model';

type RoleFilter = ClubRole | 'ALL';

@Component({
  selector: 'app-my-clubs',
  templateUrl: './my-clubs.component.html',
  styleUrls: ['./club-member-pages.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class MyClubsComponent {
  private readonly repository = inject(ClubRepositoryPort);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly defaultClubLogo = DEFAULT_CLUB_LOGO;
  readonly defaultClubBanner = DEFAULT_CLUB_BANNER;
  readonly sports = CLUB_SPORTS;
  readonly memberships = signal<MyClubMembership[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly isAuthenticated = signal(false);
  readonly keyword = signal('');
  readonly selectedRole = signal<RoleFilter>('ALL');
  readonly selectedSport = signal<SportType | 'ALL'>('ALL');
  readonly pageIndex = signal(0);
  readonly pageSize = 6;

  readonly ownerCount = computed(() => this.memberships().filter(item => item.role === 'OWNER').length);
  readonly memberCount = computed(() => this.memberships().filter(item => item.role !== 'OWNER').length);
  readonly filteredMemberships = computed(() => {
    const query = this.keyword().trim().toLocaleLowerCase('vi');
    return this.memberships().filter(item => {
      const roleMatches = this.selectedRole() === 'ALL' || item.role === this.selectedRole();
      const sportMatches = this.selectedSport() === 'ALL' || item.club.sportType === this.selectedSport();
      const textMatches = !query || [item.club.name, item.club.location, item.club.city]
        .filter(Boolean)
        .some(value => value!.toLocaleLowerCase('vi').includes(query));
      return roleMatches && sportMatches && textMatches;
    });
  });
  readonly pagedMemberships = computed(() => {
    const start = this.pageIndex() * this.pageSize;
    return this.filteredMemberships().slice(start, start + this.pageSize);
  });
  readonly hasFilters = computed(() => Boolean(this.keyword().trim()) || this.selectedRole() !== 'ALL' || this.selectedSport() !== 'ALL');

  constructor() {
    this.auth.sessionReady$.pipe(filter(Boolean), take(1)).subscribe(() => {
      this.isAuthenticated.set(this.auth.isAuthenticated);
      if (this.auth.isAuthenticated) this.load();
      else this.loading.set(false);
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.repository.getMyClubs().subscribe({
      next: memberships => {
        this.memberships.set(memberships);
        this.ensureValidPage();
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Không thể tải danh sách câu lạc bộ của bạn. Vui lòng thử lại.');
        this.loading.set(false);
      }
    });
  }

  updateKeyword(value: string): void { this.keyword.set(value); this.pageIndex.set(0); }
  updateRole(value: string): void { this.selectedRole.set(value as RoleFilter); this.pageIndex.set(0); }
  updateSport(value: string): void { this.selectedSport.set(value as SportType | 'ALL'); this.pageIndex.set(0); }
  changePage(page: number): void { this.pageIndex.set(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  clearFilters(): void { this.keyword.set(''); this.selectedRole.set('ALL'); this.selectedSport.set('ALL'); this.pageIndex.set(0); }
  login(): void { this.auth.redirectToLogin(window.location.href); }

  openClub(item: MyClubMembership): void {
    void this.router.navigate(['/clubs/my', item.club.clubId]);
  }

  roleLabel(role: ClubRole): string {
    return role === 'OWNER' ? 'Chủ CLB' : role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên';
  }

  sportLabel(value: SportType): string { return sportLabel(value); }
  useLogoFallback(event: Event): void { this.applyImageFallback(event, this.defaultClubLogo); }
  useBannerFallback(event: Event): void { this.applyImageFallback(event, this.defaultClubBanner); }

  private ensureValidPage(): void {
    const maxPage = Math.max(0, Math.ceil(this.filteredMemberships().length / this.pageSize) - 1);
    if (this.pageIndex() > maxPage) this.pageIndex.set(maxPage);
  }

  private applyImageFallback(event: Event, fallback: string): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(fallback)) image.src = fallback;
  }
}
