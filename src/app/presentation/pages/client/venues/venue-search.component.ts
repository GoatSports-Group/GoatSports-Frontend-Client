import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { VENUE_SEARCH_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-search.repository';
import { Venue, VenueSearchFilter, SPORT_TYPE_OPTIONS } from '@application/dto/venue/venue.dto';

@Component({
  selector: 'app-venue-search',
  templateUrl: './venue-search.component.html',
  styleUrls: ['./venue-search.component.scss'],
  standalone: false
})
export class VenueSearchComponent implements OnInit {
  private venueSearchRepo = inject(VENUE_SEARCH_REPOSITORY_TOKEN);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly sportTypes = SPORT_TYPE_OPTIONS;
  readonly pageSize = 12;

  venues: Venue[] = [];
  loading = true;
  locating = false;
  errorMessage = '';
  totalVenues = 0;
  totalPages = 0;
  currentPage = 0;

  filter: VenueSearchFilter = this.emptyFilter();

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.filter = {
          keyword: params.get('keyword') || '',
          sportType: params.get('sportType') || 'all',
          district: params.get('district') || '',
          city: params.get('city') || '',
          latitude: this.toOptionalNumber(params.get('latitude')),
          longitude: this.toOptionalNumber(params.get('longitude')),
          radiusKm: this.toOptionalNumber(params.get('radiusKm')),
          minPrice: this.toOptionalNumber(params.get('minPrice')),
          maxPrice: this.toOptionalNumber(params.get('maxPrice')),
          minRating: this.toOptionalNumber(params.get('minRating')),
          page: this.toPage(params.get('page')),
          size: this.pageSize
        };
        this.currentPage = this.filter.page || 0;
        this.loadVenues();
      });
  }

  loadVenues(): void {
    this.loading = true;
    this.errorMessage = '';

    this.venueSearchRepo.searchVenues({
      ...this.filter,
      page: this.currentPage,
      size: this.pageSize
    }).subscribe({
      next: response => {
        this.venues = response?.data?.items || [];
        this.totalVenues = response?.data?.total || 0;
        this.totalPages = response?.data?.totalPages || 0;
        this.loading = false;
      },
      error: error => {
        console.error('Error loading venues:', error);
        this.venues = [];
        this.totalVenues = 0;
        this.totalPages = 0;
        this.errorMessage = error?.error?.message || 'Không thể tải danh sách sân. Vui lòng thử lại.';
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.navigateWithFilters(0);
  }

  selectSport(sportValue: string): void {
    this.filter.sportType = this.filter.sportType === sportValue ? 'all' : sportValue;
    this.applyFilters();
  }

  resetFilters(): void {
    this.filter = this.emptyFilter();
    this.navigateWithFilters(0);
  }

  onPageChange(page: number): void {
    if (page < 0 || page >= this.totalPages || page === this.currentPage) return;
    this.navigateWithFilters(page).then(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.errorMessage = 'Trình duyệt của bạn không hỗ trợ định vị.';
      return;
    }

    this.locating = true;
    this.errorMessage = '';
    navigator.geolocation.getCurrentPosition(
      position => {
        this.filter.latitude = Number(position.coords.latitude.toFixed(6));
        this.filter.longitude = Number(position.coords.longitude.toFixed(6));
        this.filter.radiusKm = this.filter.radiusKm || 10;
        this.locating = false;
        this.applyFilters();
      },
      () => {
        this.locating = false;
        this.errorMessage = 'Không thể lấy vị trí. Hãy cấp quyền định vị rồi thử lại.';
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }

  clearLocation(): void {
    this.filter.latitude = undefined;
    this.filter.longitude = undefined;
    this.filter.radiusKm = undefined;
    this.applyFilters();
  }

  get locationActive(): boolean {
    return this.filter.latitude != null && this.filter.longitude != null;
  }

  get hasFilters(): boolean {
    return Boolean(
      this.filter.keyword || this.filter.district || this.filter.city
      || this.filter.sportType !== 'all' || this.filter.minPrice != null
      || this.filter.maxPrice != null || this.filter.minRating != null
      || this.locationActive
    );
  }

  get visiblePages(): number[] {
    if (this.totalPages <= 1) return [];
    const start = Math.max(0, Math.min(this.currentPage - 2, this.totalPages - 5));
    const count = Math.min(5, this.totalPages);
    return Array.from({ length: count }, (_, index) => start + index);
  }

  private navigateWithFilters(page: number): Promise<boolean> {
    const queryParams = {
      keyword: this.cleanText(this.filter.keyword),
      sportType: this.filter.sportType && this.filter.sportType !== 'all' ? this.filter.sportType : null,
      district: this.cleanText(this.filter.district),
      city: this.cleanText(this.filter.city),
      latitude: this.filter.latitude ?? null,
      longitude: this.filter.longitude ?? null,
      radiusKm: this.locationActive ? (this.filter.radiusKm ?? 10) : null,
      minPrice: this.filter.minPrice ?? null,
      maxPrice: this.filter.maxPrice ?? null,
      minRating: this.filter.minRating ?? null,
      page: page > 0 ? page : null
    };

    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: false
    }).then(navigated => {
      if (!navigated) this.loadVenues();
      return navigated;
    });
  }

  private emptyFilter(): VenueSearchFilter {
    return {
      keyword: '',
      sportType: 'all',
      district: '',
      city: '',
      minPrice: undefined,
      maxPrice: undefined,
      minRating: undefined,
      page: 0,
      size: this.pageSize
    };
  }

  private cleanText(value?: string): string | null {
    return value?.trim() || null;
  }

  private toOptionalNumber(value: string | null): number | undefined {
    if (value == null || value.trim() === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private toPage(value: string | null): number {
    const page = this.toOptionalNumber(value);
    return page != null && page >= 0 ? Math.floor(page) : 0;
  }
}
