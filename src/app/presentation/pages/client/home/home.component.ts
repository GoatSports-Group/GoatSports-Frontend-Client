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
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as L from 'leaflet';
import { VENUE_SEARCH_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-search.repository';
import { SportType, SPORT_TYPE_OPTIONS, Venue } from '@application/dto/venue/venue.dto';

type LocationState = 'locating' | 'ready' | 'error' | 'unsupported';

interface LocationSuggestion {
  refId: string;
  title: string;
  displayName: string;
  latitude: number;
  longitude: number;
}

const MAX_EARTH_SURFACE_DISTANCE_KM = 20_050;

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  standalone: false
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('locationPickerMap') private locationPickerMap?: ElementRef<HTMLElement>;

  private router = inject(Router);
  private venueSearchRepo = inject(VENUE_SEARCH_REPOSITORY_TOKEN);
  private host = inject(ElementRef<HTMLElement>);
  private zone = inject(NgZone);
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);
  private animationContext?: ReturnType<typeof gsap.context>;
  private locationSearchVersion = 0;
  private pickerReverseGeocodeVersion = 0;
  private pickerReverseGeocodeTimer?: ReturnType<typeof setTimeout>;
  private nearbySearchVersion = 0;
  private map?: L.Map;
  private mapMarker?: L.CircleMarker;
  private mapResizeObserver?: ResizeObserver;

  readonly SportType = SportType;
  readonly sportOptions = [
    SPORT_TYPE_OPTIONS.find(option => option.value === SportType.FOOTBALL)!,
    SPORT_TYPE_OPTIONS.find(option => option.value === SportType.BADMINTON)!,
    SPORT_TYPE_OPTIONS.find(option => option.value === SportType.PICKLEBALL)!,
    SPORT_TYPE_OPTIONS.find(option => option.value === SportType.TENNIS)!,
    SPORT_TYPE_OPTIONS.find(option => option.value === SportType.BASKETBALL)!,
    SPORT_TYPE_OPTIONS.find(option => option.value === SportType.VOLLEYBALL)!
  ];

  featuredVenues: Venue[] = [];
  loading = true;
  locationState: LocationState = 'locating';
  locationMessage = 'Đang xác định vị trí hiện tại...';
  locationPickerOpen = false;
  locationSearchQuery = '';
  locationSearchLoading = false;
  locationAddressLoading = false;
  locationSearchError = '';
  locationSuggestions: LocationSuggestion[] = [];
  pendingLatitude?: number;
  pendingLongitude?: number;
  pendingLocationMessage = '';
  radiusKm = 10;
  appliedRadiusKm = 10;
  radiusError = '';
  selectedSport: SportType | null = SportType.FOOTBALL;
  latitude?: number;
  longitude?: number;

  get hasCurrentLocation(): boolean {
    return this.latitude != null && this.longitude != null;
  }

  get visibleFeaturedVenues(): Venue[] {
    return this.featuredVenues.slice(0, 4);
  }

  ngOnInit(): void {
    this.requestCurrentLocation();
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    this.zone.runOutsideAngular(() => {
      gsap.registerPlugin(ScrollTrigger);
      this.animationContext = gsap.context(() => {
        gsap.from('.home-hero__content > *', {
          autoAlpha: 0,
          y: 24,
          duration: .7,
          stagger: .08,
          ease: 'power3.out'
        });

        gsap.to('.home-hero__image', {
          yPercent: 9,
          ease: 'none',
          scrollTrigger: {
            trigger: '.home-hero',
            start: 'top top',
            end: 'bottom top',
            scrub: .6
          }
        });

      }, this.host.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.animationContext?.revert();
    if (this.pickerReverseGeocodeTimer) clearTimeout(this.pickerReverseGeocodeTimer);
    this.mapResizeObserver?.disconnect();
    this.map?.remove();
  }

  requestCurrentLocation(): void {
    if (!isPlatformBrowser(this.platformId) || !navigator.geolocation) {
      this.locationState = 'unsupported';
      this.locationMessage = 'Trình duyệt không hỗ trợ định vị.';
      this.loading = false;
      return;
    }

    this.locationState = 'locating';
    this.locationMessage = 'Đang xác định vị trí hiện tại...';
    this.loading = true;
    navigator.geolocation.getCurrentPosition(
      position => {
        this.latitude = Number(position.coords.latitude.toFixed(6));
        this.longitude = Number(position.coords.longitude.toFixed(6));
        this.locationState = 'ready';
        this.locationMessage = 'Đang xác định địa chỉ...';
        void this.resolveCurrentLocationName(this.latitude, this.longitude);
        this.loadNearbyVenues();
      },
      error => {
        this.featuredVenues = [];
        this.loading = false;
        this.locationState = 'error';
        this.locationMessage = error.code === error.PERMISSION_DENIED
          ? 'Bạn chưa cấp quyền truy cập vị trí.'
          : 'Không thể xác định vị trí hiện tại.';
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }

  loadNearbyVenues(): void {
    const searchVersion = ++this.nearbySearchVersion;
    if (!this.hasCurrentLocation) {
      this.featuredVenues = [];
      this.loading = false;
      return;
    }

    const worldwideSearch = this.appliedRadiusKm >= MAX_EARTH_SURFACE_DISTANCE_KM;
    this.loading = true;
    this.venueSearchRepo.searchVenues({
      sportType: this.selectedSport ?? undefined,
      latitude: this.latitude,
      longitude: this.longitude,
      radiusKm: worldwideSearch ? undefined : this.appliedRadiusKm,
      page: 0,
      size: worldwideSearch ? 100 : 8
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        if (searchVersion !== this.nearbySearchVersion) return;
        this.featuredVenues = (res?.data?.items || [])
          .filter(venue => worldwideSearch
            || (venue.distanceKm != null && venue.distanceKm <= this.appliedRadiusKm))
          .sort((left, right) => (left.distanceKm ?? Infinity) - (right.distanceKm ?? Infinity))
          .slice(0, 8);
        this.loading = false;
      },
      error: err => {
        if (searchVersion !== this.nearbySearchVersion) return;
        console.error('Error loading featured venues:', err);
        this.featuredVenues = [];
        this.loading = false;
      }
    });
  }

  applyRadius(): void {
    const requestedRadius = Number(this.radiusKm);
    if (!Number.isFinite(requestedRadius) || requestedRadius <= 0) {
      this.radiusError = 'Bán kính phải lớn hơn 0 km.';
      return;
    }

    this.radiusError = '';
    this.radiusKm = requestedRadius;
    this.appliedRadiusKm = requestedRadius;
    this.loadNearbyVenues();
  }

  openLocationPicker(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.pendingLatitude = this.latitude ?? 16.047079;
    this.pendingLongitude = this.longitude ?? 108.206230;
    this.pendingLocationMessage = this.hasCurrentLocation
      ? this.locationMessage
      : 'Chọn một điểm trên bản đồ';
    this.locationSearchQuery = '';
    this.locationSearchError = '';
    this.locationAddressLoading = false;
    this.locationSearchVersion++;
    this.pickerReverseGeocodeVersion++;
    if (this.pickerReverseGeocodeTimer) clearTimeout(this.pickerReverseGeocodeTimer);
    this.locationSuggestions = [];
    this.locationPickerOpen = true;
    setTimeout(() => this.initializeLocationMap());
  }

  closeLocationPicker(): void {
    this.locationPickerOpen = false;
    this.locationSuggestions = [];
    this.locationSearchError = '';
    this.locationSearchVersion++;
    this.pickerReverseGeocodeVersion++;
    if (this.pickerReverseGeocodeTimer) clearTimeout(this.pickerReverseGeocodeTimer);
    this.locationAddressLoading = false;
    this.mapResizeObserver?.disconnect();
    this.mapResizeObserver = undefined;
    this.map?.remove();
    this.map = undefined;
    this.mapMarker = undefined;
  }

  useDeviceLocationInPicker(): void {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(position => {
      this.zone.run(() => this.updatePickerLocation(
        position.coords.latitude,
        position.coords.longitude,
        true
      ));
    });
  }

  async searchPickerLocation(): Promise<void> {
    const query = this.locationSearchQuery.trim();
    if (query.length < 3 || this.locationSearchLoading) return;

    const searchVersion = ++this.locationSearchVersion;
    this.locationSearchLoading = true;
    this.locationSearchError = '';
    this.locationSuggestions = [];
    try {
      const response = await firstValueFrom(this.venueSearchRepo.searchLocations(query.slice(0, 160)));
      if (searchVersion !== this.locationSearchVersion) return;
      const results = response?.data ?? [];
      this.locationSuggestions = (results ?? []).map(result => ({
        refId: `${result.latitude},${result.longitude}`,
        title: result.title?.trim() || result.address,
        displayName: result.address,
        latitude: result.latitude,
        longitude: result.longitude
      })).filter(result => result.title && result.displayName).slice(0, 6);
      if (!this.locationSuggestions.length) {
        this.locationSearchError = 'Không tìm thấy địa chỉ phù hợp. Hãy nhập địa chỉ cụ thể hơn.';
      }
    } catch {
      if (searchVersion !== this.locationSearchVersion) return;
      this.locationSuggestions = [];
      this.locationSearchError = 'Không thể tìm địa chỉ lúc này. Vui lòng thử lại.';
    } finally {
      if (searchVersion === this.locationSearchVersion) {
        this.locationSearchLoading = false;
      }
    }
  }

  selectPickerSuggestion(suggestion: LocationSuggestion): void {
    this.pickerReverseGeocodeVersion++;
    if (this.pickerReverseGeocodeTimer) clearTimeout(this.pickerReverseGeocodeTimer);
    this.locationSuggestions = [];
    this.locationSearchError = '';
    this.locationSearchLoading = false;
    this.locationSearchQuery = suggestion.title;
    this.pendingLocationMessage = suggestion.displayName;
    this.locationAddressLoading = false;
    this.updatePickerLocation(suggestion.latitude, suggestion.longitude, false);
  }

  confirmPickerLocation(): void {
    if (this.pendingLatitude == null || this.pendingLongitude == null) return;
    this.latitude = Number(this.pendingLatitude.toFixed(6));
    this.longitude = Number(this.pendingLongitude.toFixed(6));
    this.locationMessage = this.pendingLocationMessage || 'Vị trí đã chọn';
    this.locationState = 'ready';
    this.closeLocationPicker();
    this.loadNearbyVenues();
  }

  onSearch(): void {
    this.openVenueSearch();
  }

  selectSport(sportType: SportType | null): void {
    if (this.selectedSport === sportType) return;
    this.selectedSport = sportType;
    this.loadNearbyVenues();
  }

  openVenueSearch(sportType?: string): void {
    this.router.navigate(['/venues'], {
      queryParams: {
        sportType: sportType || null,
        latitude: this.latitude ?? null,
        longitude: this.longitude ?? null,
        radiusKm: this.hasCurrentLocation ? this.appliedRadiusKm : null
      }
    });
  }

  private async resolveCurrentLocationName(latitude: number, longitude: number): Promise<void> {
    try {
      const response = await firstValueFrom(this.venueSearchRepo.reverseGeocode(latitude, longitude));
      this.zone.run(() => this.locationMessage = response?.data?.address || 'Vị trí hiện tại của bạn');
    } catch (error) {
      console.warn('Unable to resolve the current location name.', error);
      this.zone.run(() => this.locationMessage = 'Vị trí hiện tại của bạn');
    }
  }

  private initializeLocationMap(): void {
    const element = this.locationPickerMap?.nativeElement;
    if (!element || this.pendingLatitude == null || this.pendingLongitude == null) return;

    this.mapResizeObserver?.disconnect();
    this.map?.remove();
    this.map = L.map(element, { zoomControl: true }).setView(
      [this.pendingLatitude, this.pendingLongitude],
      14
    );
    L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
      maxZoom: 19,
      keepBuffer: 2,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);
    this.map.on('click', event => this.zone.run(() => {
      this.updatePickerLocation(event.latlng.lat, event.latlng.lng, true);
    }));
    this.mapResizeObserver = new ResizeObserver(() => this.map?.invalidateSize({ pan: false }));
    this.mapResizeObserver.observe(element);
    this.updateMapMarker();
    requestAnimationFrame(() => this.map?.invalidateSize({ pan: false }));
  }

  private updatePickerLocation(latitude: number, longitude: number, resolveName: boolean): void {
    this.pendingLatitude = Number(latitude.toFixed(6));
    this.pendingLongitude = Number(longitude.toFixed(6));
    this.map?.setView([latitude, longitude], Math.max(this.map.getZoom(), 14), { animate: true });
    this.updateMapMarker();
    if (resolveName) this.schedulePickerLocationName(latitude, longitude);
  }

  private updateMapMarker(): void {
    if (!this.map || this.pendingLatitude == null || this.pendingLongitude == null) return;
    const coordinates: L.LatLngExpression = [this.pendingLatitude, this.pendingLongitude];
    if (this.mapMarker) {
      this.mapMarker.setLatLng(coordinates);
      return;
    }
    this.mapMarker = L.circleMarker(coordinates, {
      radius: 9,
      color: '#ffffff',
      weight: 4,
      fillColor: '#00865f',
      fillOpacity: 1
    }).addTo(this.map);
  }

  private schedulePickerLocationName(latitude: number, longitude: number): void {
    const requestVersion = ++this.pickerReverseGeocodeVersion;
    if (this.pickerReverseGeocodeTimer) clearTimeout(this.pickerReverseGeocodeTimer);
    this.locationAddressLoading = true;
    this.pendingLocationMessage = 'Đang xác định địa chỉ...';
    this.pickerReverseGeocodeTimer = setTimeout(
      () => void this.resolvePickerLocationName(latitude, longitude, requestVersion),
      500
    );
  }

  private async resolvePickerLocationName(
    latitude: number,
    longitude: number,
    requestVersion: number
  ): Promise<void> {
    try {
      const response = await firstValueFrom(this.venueSearchRepo.reverseGeocode(latitude, longitude));
      if (requestVersion !== this.pickerReverseGeocodeVersion) return;
      this.pendingLocationMessage = response?.data?.address || coordinateFallback(latitude, longitude);
    } catch {
      if (requestVersion !== this.pickerReverseGeocodeVersion) return;
      this.pendingLocationMessage = coordinateFallback(latitude, longitude);
    } finally {
      if (requestVersion === this.pickerReverseGeocodeVersion) {
        this.locationAddressLoading = false;
      }
    }
  }
}

function coordinateFallback(latitude: number, longitude: number): string {
  return `Vị trí đã chọn (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`;
}
