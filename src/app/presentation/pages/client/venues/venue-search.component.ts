import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import * as L from 'leaflet';
import { catchError, of, take } from 'rxjs';
import { Venue, VenueSearchFilter } from '@application/dto/venue/venue.dto';
import { VENUE_SEARCH_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-search.repository';
import { GetStorageFileUrlUseCase } from '@application/usecase/storage/get-storage-file-url.usecase';
import {
  isAbsoluteVenueImageUrl,
  VENUE_PLACEHOLDER_IMAGE
} from '@presentation/shared/utils/venue-media.utils';

type VenueSort = 'distance' | 'rating' | 'price';
const MAX_EARTH_SURFACE_DISTANCE_KM = 20_050;

@Component({
  selector: 'app-venue-search',
  templateUrl: './venue-search.component.html',
  styleUrls: ['./venue-search.component.scss'],
  standalone: false
})
export class VenueSearchComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('venueMap') private venueMap?: ElementRef<HTMLElement>;

  private readonly venueSearchRepo = inject(VENUE_SEARCH_REPOSITORY_TOKEN);
  private readonly getFileUrl = inject(GetStorageFileUrlUseCase);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);

  private map?: L.Map;
  private markerLayer?: L.LayerGroup;
  private readonly venueMarkers = new Map<string, L.CircleMarker>();
  private mapResizeObserver?: ResizeObserver;
  private selectedImageKey = '';
  private venueSearchVersion = 0;

  readonly pageSize = 12;
  readonly placeholderImage = VENUE_PLACEHOLDER_IMAGE;
  readonly sportOptions = [
    { value: 'all', label: 'Tất cả', icon: 'layout-grid' },
    { value: 'FOOTBALL', label: 'Bóng đá', icon: 'circle-dot' },
    { value: 'BADMINTON', label: 'Cầu lông', icon: 'activity' },
    { value: 'TENNIS', label: 'Tennis', icon: 'circle' },
    { value: 'BASKETBALL', label: 'Bóng rổ', icon: 'circle-dot-dashed' },
    { value: 'VOLLEYBALL', label: 'Bóng chuyền', icon: 'circle-dot-dashed' },
    { value: 'PICKLEBALL', label: 'Pickleball', icon: 'circle-dot' }
  ];

  venues: Venue[] = [];
  selectedVenue: Venue | null = null;
  selectedVenueImage = VENUE_PLACEHOLDER_IMAGE;
  loading = true;
  locating = false;
  errorMessage = '';
  totalVenues = 0;
  totalPages = 0;
  currentPage = 0;
  sortBy: VenueSort = 'distance';
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
          northLatitude: this.toOptionalNumber(params.get('northLatitude')),
          southLatitude: this.toOptionalNumber(params.get('southLatitude')),
          eastLongitude: this.toOptionalNumber(params.get('eastLongitude')),
          westLongitude: this.toOptionalNumber(params.get('westLongitude')),
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

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    requestAnimationFrame(() => this.initializeMap());
  }

  ngOnDestroy(): void {
    this.mapResizeObserver?.disconnect();
    this.map?.remove();
  }

  get displayedVenues(): Venue[] {
    const result = [...this.venues];
    if (this.sortBy === 'rating') {
      return result.sort((left, right) => (right.averageRating || 0) - (left.averageRating || 0));
    }
    if (this.sortBy === 'price') {
      return result.sort((left, right) => (left.minPrice ?? Number.MAX_SAFE_INTEGER) - (right.minPrice ?? Number.MAX_SAFE_INTEGER));
    }
    return result.sort((left, right) => (left.distanceKm ?? Number.MAX_SAFE_INTEGER) - (right.distanceKm ?? Number.MAX_SAFE_INTEGER));
  }

  loadVenues(): void {
    const searchVersion = ++this.venueSearchVersion;
    this.loading = true;
    this.errorMessage = '';

    const worldwideSearch = this.locationActive
      && (this.filter.radiusKm ?? 0) >= MAX_EARTH_SURFACE_DISTANCE_KM;

    this.venueSearchRepo.searchVenues({
      ...this.filter,
      radiusKm: worldwideSearch || this.viewportSearchActive ? undefined : this.filter.radiusKm,
      page: this.currentPage,
      size: this.pageSize
    }).subscribe({
      next: response => {
        if (searchVersion !== this.venueSearchVersion) return;
        this.venues = response?.data?.items || [];
        this.totalVenues = response?.data?.total || 0;
        this.totalPages = response?.data?.totalPages || 0;
        this.loading = false;
        this.syncSelectedVenue();
        requestAnimationFrame(() => this.renderMapMarkers(true));
      },
      error: error => {
        if (searchVersion !== this.venueSearchVersion) return;
        console.error('Error loading venues:', error);
        this.venues = [];
        this.selectedVenue = null;
        this.totalVenues = 0;
        this.totalPages = 0;
        this.errorMessage = error?.error?.message || 'Không thể tải danh sách sân. Vui lòng thử lại.';
        this.loading = false;
        requestAnimationFrame(() => this.renderMapMarkers(true));
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
        this.clearViewportBounds();
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

  searchVisibleArea(): void {
    if (!this.map) return;
    const bounds = this.map.getBounds();
    this.filter.northLatitude = this.roundCoordinate(bounds.getNorth());
    this.filter.southLatitude = this.roundCoordinate(bounds.getSouth());
    this.filter.eastLongitude = this.roundCoordinate(bounds.getEast());
    this.filter.westLongitude = this.roundCoordinate(bounds.getWest());
    this.applyFilters();
  }

  applyRadiusFilter(): void {
    this.clearViewportBounds();
    this.applyFilters();
  }

  clearLocation(): void {
    this.filter.latitude = undefined;
    this.filter.longitude = undefined;
    this.filter.radiusKm = undefined;
    this.clearViewportBounds();
    this.applyFilters();
  }

  selectVenue(venue: Venue, focusMap = true): void {
    if (this.selectedVenue?.venueId === venue.venueId) return;
    this.selectedVenue = venue;
    this.resolveSelectedVenueImage(venue);
    this.renderMapMarkers(false);

    const coordinates = this.venueCoordinates(venue);
    if (focusMap && coordinates && this.map) {
      this.map.setView(coordinates, Math.max(this.map.getZoom(), 14), { animate: false });
    }
  }

  clearVenueSelection(): void {
    this.selectedVenue = null;
    this.selectedVenueImage = VENUE_PLACEHOLDER_IMAGE;
    this.renderMapMarkers(false);
  }

  onSelectedImageError(): void {
    this.selectedVenueImage = VENUE_PLACEHOLDER_IMAGE;
  }

  get locationActive(): boolean {
    return this.filter.latitude != null && this.filter.longitude != null;
  }

  get viewportSearchActive(): boolean {
    return this.filter.northLatitude != null
      && this.filter.southLatitude != null
      && this.filter.eastLongitude != null
      && this.filter.westLongitude != null;
  }

  get hasFilters(): boolean {
    return Boolean(
      this.filter.keyword || this.filter.district || this.filter.city
      || this.filter.sportType !== 'all' || this.filter.minPrice != null
      || this.filter.maxPrice != null || this.filter.minRating != null
      || this.locationActive || this.viewportSearchActive
    );
  }

  get visiblePages(): number[] {
    if (this.totalPages <= 1) return [];
    const start = Math.max(0, Math.min(this.currentPage - 2, this.totalPages - 5));
    const count = Math.min(5, this.totalPages);
    return Array.from({ length: count }, (_, index) => start + index);
  }

  formatPrice(price: number | null | undefined): string {
    if (price == null) return 'Liên hệ';
    return `${new Intl.NumberFormat('vi-VN').format(price)} đ`;
  }

  sportLabel(venue: Venue): string {
    const sport = venue.sportTypes?.[0];
    return this.sportOptions.find(option => option.value === sport)?.label || 'Thể thao';
  }

  private syncSelectedVenue(): void {
    const previousId = this.selectedVenue?.venueId;
    const next = this.venues.find(venue => venue.venueId === previousId)
      || this.venues.find(venue => this.venueCoordinates(venue) != null)
      || this.venues[0]
      || null;
    this.selectedVenue = next;
    if (next) {
      const nextImageKey = next.imageUrls?.[0]?.trim() || '';
      if (next.venueId !== previousId || nextImageKey !== this.selectedImageKey) {
        this.resolveSelectedVenueImage(next);
      }
    } else {
      this.selectedVenueImage = VENUE_PLACEHOLDER_IMAGE;
    }
  }

  private initializeMap(): void {
    const element = this.venueMap?.nativeElement;
    if (!element || this.map) return;

    const initialCenter = this.initialMapCenter();
    this.map = L.map(element, { zoomControl: false }).setView(initialCenter, 13);
    L.control.zoom({ position: 'topright' }).addTo(this.map);
    L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
      maxZoom: 19,
      keepBuffer: 2,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);
    this.markerLayer = L.layerGroup().addTo(this.map);
    this.mapResizeObserver = new ResizeObserver(() => this.map?.invalidateSize({ pan: false }));
    this.mapResizeObserver.observe(element);
    const viewportBounds = this.getViewportBounds();
    if (viewportBounds) this.map.fitBounds(viewportBounds, { animate: false });
    this.renderMapMarkers(true);
    requestAnimationFrame(() => this.map?.invalidateSize({ pan: false }));
  }

  private renderMapMarkers(fitBounds: boolean): void {
    if (!this.map || !this.markerLayer) return;
    const coordinates: L.LatLngTuple[] = [];
    const visibleVenueIds = new Set<string>();

    this.venues.forEach(venue => {
      const point = this.venueCoordinates(venue);
      if (!point) return;
      visibleVenueIds.add(venue.venueId);
      coordinates.push(point);
      const selected = venue.venueId === this.selectedVenue?.venueId;
      let marker = this.venueMarkers.get(venue.venueId);
      if (!marker) {
        marker = L.circleMarker(point, { className: 'venue-map-marker' }).addTo(this.markerLayer!);
        marker.bindTooltip(venue.name, {
          className: 'venue-map-tooltip',
          direction: 'top',
          offset: L.point(0, -7),
          opacity: 1
        });
        this.venueMarkers.set(venue.venueId, marker);
      } else {
        marker.setLatLng(point);
        marker.setTooltipContent(venue.name);
      }
      marker.setRadius(selected ? 11 : 7);
      marker.setStyle({
        color: '#ffffff',
        weight: selected ? 4 : 3,
        fillColor: selected ? '#006f4e' : '#0a9a72',
        fillOpacity: 1
      });
      marker.getElement()?.classList.toggle('venue-map-marker--selected', selected);
      marker.off('click');
      marker.on('click', () => this.zone.run(() => this.selectVenue(venue, false)));
      if (selected) marker.openTooltip();
      else marker.closeTooltip();
    });

    this.venueMarkers.forEach((marker, venueId) => {
      if (visibleVenueIds.has(venueId)) return;
      this.markerLayer!.removeLayer(marker);
      this.venueMarkers.delete(venueId);
    });

    if (!fitBounds) return;
    if (this.viewportSearchActive) return;
    if (this.locationActive) {
      this.map.setView([this.filter.latitude!, this.filter.longitude!], 13);
    } else if (coordinates.length === 1) {
      this.map.setView(coordinates[0], 14);
    } else if (coordinates.length > 1) {
      this.map.fitBounds(L.latLngBounds(coordinates), { padding: [42, 42], maxZoom: 14 });
    }
  }

  private initialMapCenter(): L.LatLngTuple {
    if (this.viewportSearchActive) {
      return [
        (this.filter.northLatitude! + this.filter.southLatitude!) / 2,
        (this.filter.eastLongitude! + this.filter.westLongitude!) / 2
      ];
    }
    if (this.locationActive) return [this.filter.latitude!, this.filter.longitude!];
    const venuePoint = this.venues.map(venue => this.venueCoordinates(venue)).find(Boolean);
    return venuePoint || [10.7769, 106.7009];
  }

  private venueCoordinates(venue: Venue): L.LatLngTuple | null {
    const latitude = Number(venue.latitude);
    const longitude = Number(venue.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0
      ? [latitude, longitude]
      : null;
  }

  private resolveSelectedVenueImage(venue: Venue): void {
    const image = venue.imageUrls?.[0]?.trim() || '';
    this.selectedImageKey = image;
    this.selectedVenueImage = VENUE_PLACEHOLDER_IMAGE;
    if (!image) return;
    if (isAbsoluteVenueImageUrl(image)) {
      this.selectedVenueImage = image;
      return;
    }

    this.getFileUrl.execute(image).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      catchError(() => of(''))
    ).subscribe(url => {
      if (this.selectedImageKey !== image) return;
      const resolvedUrl = url.trim();
      this.selectedVenueImage = isAbsoluteVenueImageUrl(resolvedUrl)
        ? resolvedUrl
        : VENUE_PLACEHOLDER_IMAGE;
    });
  }

  private navigateWithFilters(page: number): Promise<boolean> {
    const requestedRadius = Number(this.filter.radiusKm);
    const radiusKm = Number.isFinite(requestedRadius) && requestedRadius > 0
      ? requestedRadius
      : 10;
    const queryParams = {
      keyword: this.cleanText(this.filter.keyword),
      sportType: this.filter.sportType && this.filter.sportType !== 'all' ? this.filter.sportType : null,
      district: this.cleanText(this.filter.district),
      city: this.cleanText(this.filter.city),
      latitude: this.filter.latitude ?? null,
      longitude: this.filter.longitude ?? null,
      radiusKm: this.locationActive ? radiusKm : null,
      northLatitude: this.filter.northLatitude ?? null,
      southLatitude: this.filter.southLatitude ?? null,
      eastLongitude: this.filter.eastLongitude ?? null,
      westLongitude: this.filter.westLongitude ?? null,
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

  private clearViewportBounds(): void {
    this.filter.northLatitude = undefined;
    this.filter.southLatitude = undefined;
    this.filter.eastLongitude = undefined;
    this.filter.westLongitude = undefined;
  }

  private getViewportBounds(): L.LatLngBoundsExpression | null {
    if (!this.viewportSearchActive) return null;
    return [
      [this.filter.southLatitude!, this.filter.westLongitude!],
      [this.filter.northLatitude!, this.filter.eastLongitude!]
    ];
  }

  private roundCoordinate(value: number): number {
    return Number(value.toFixed(6));
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
