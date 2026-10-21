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
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, map, of, switchMap } from 'rxjs';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as L from 'leaflet';
import { AiRepositoryPort } from '@application/ports/ai.repository.port';
import { VENUE_SEARCH_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-search.repository';
import { SOCIAL_FEED_REPOSITORY_TOKEN } from '@application/ports/persistence/social-feed.repository';
import { SocialPost } from '@application/dto/social-feed/social-feed.dto';
import { AuthService } from '@presentation/services/auth.service';
import { CommunityStore } from '@presentation/pages/client/feed/community.store';
import { pageScroller } from './landing/landing-motion';
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
/** ai-service chỉ gợi ý trong bán kính này; xa hơn thì xếp theo khoảng cách như khách. */
const MAX_RECOMMENDATION_RADIUS_KM = 100;
/**
 * Máy tính không có GPS: trình duyệt đoán vị trí theo IP / mạng, thường ra tâm Hà Nội hay TP.HCM với sai số hàng chục km.
 * Trên ngưỡng này thì coi là ước lượng: vẫn dùng tạm nhưng nói rõ và mời chọn lại.
 */
const COARSE_ACCURACY_METERS = 1500;
/** Vị trí người dùng tự chọn trên bản đồ, dùng lại ở lần mở sau (chỉ trên trình duyệt này). */
const SAVED_LOCATION_KEY = 'goat.home.location';

interface SavedLocation { latitude: number; longitude: number; label: string }

/** Đã đăng nhập: "Dành cho bạn" (hợp thói quen đặt / xem sân) hoặc "Gần nhất". */
export type VenueOrder = 'forYou' | 'nearest';

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
  private socialFeed = inject(SOCIAL_FEED_REPOSITORY_TOKEN);
  private communityStore = inject(CommunityStore);
  private auth = inject(AuthService);
  private ai = inject(AiRepositoryPort);
  /** Keo ca nhan "Tim nguoi choi" con mo; null = dang tai. Khach chua dang nhap khong goi API (gateway yeu cau dang nhap). */
  readonly openCalls = signal<SocialPost[] | null>(null);
  readonly openCallsError = signal(false);
  /** Theo dõi phiên: bị đăng xuất khi đang ở trang chủ (khóa / chờ xóa / hết phiên) thì đổi ngay sang trang khách. */
  readonly signedIn = toSignal(this.auth.isAuthenticated$, { requireSync: true });
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
  venueOrder: VenueOrder = 'forYou';
  /** Lý do gợi ý theo venueId, chỉ có khi danh sách là "Dành cho bạn". */
  venueReasons = new Map<string, string>();
  loading = true;
  locationState: LocationState = 'locating';
  locationMessage = 'Đang xác định vị trí hiện tại...';
  /** Sai số (km) khi vị trí chỉ là ước lượng theo mạng; null khi chính xác hoặc do người dùng tự chọn. */
  locationAccuracyKm: number | null = null;
  /** Như trên, cho nút "Vị trí của tôi" trong hộp chọn vị trí. */
  pickerAccuracyKm: number | null = null;
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

  /** Dải sân nổi bật cuộn ngang nên hiện đủ (tối đa 8 sân gần nhất). */
  get visibleFeaturedVenues(): Venue[] {
    return this.featuredVenues;
  }

  ngOnInit(): void {
    if (!this.restoreSavedLocation()) this.requestCurrentLocation();
    if (this.signedIn()) this.loadOpenCalls();
  }

  loadOpenCalls(): void {
    this.openCalls.set(null);
    this.openCallsError.set(false);
    this.socialFeed.getOpenPlayerCalls(false, 4).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: posts => {
        this.communityStore.hydrate(posts);
        this.openCalls.set(posts);
      },
      error: () => {
        this.openCallsError.set(true);
        this.openCalls.set([]);
      }
    });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    this.zone.runOutsideAngular(() => {
      gsap.registerPlugin(ScrollTrigger);
      this.animationContext = gsap.context(() => {
        // Các bảng của Trang chủ (Hôm nay, Dành cho bạn, Cộng đồng) hiện dần khi cuộn tới.
        ScrollTrigger.batch('.home-panel', {
          scroller: pageScroller(this.host.nativeElement),
          start: 'top 92%',
          once: true,
          onEnter: panels => gsap.from(panels, {
            autoAlpha: 0, y: 12, duration: .32, stagger: .08, ease: 'power3.out', clearProps: 'opacity,visibility,transform'
          })
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
        this.locationAccuracyKm = coarseAccuracyKm(position.coords.accuracy);
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

  /** Gợi ý chỉ có khi đã đăng nhập, đã chọn một môn và bán kính trong tầm gợi ý. */
  get canRecommend(): boolean {
    return this.signedIn() && this.selectedSport !== null && this.appliedRadiusKm <= MAX_RECOMMENDATION_RADIUS_KM;
  }

  setVenueOrder(order: VenueOrder): void {
    if (this.venueOrder === order) return;
    this.venueOrder = order;
    this.loadNearbyVenues();
  }

  loadNearbyVenues(): void {
    const searchVersion = ++this.nearbySearchVersion;
    this.venueReasons = new Map();
    if (!this.hasCurrentLocation) {
      this.featuredVenues = [];
      this.loading = false;
      return;
    }
    if (this.venueOrder === 'forYou' && this.canRecommend) {
      this.loadRecommendedVenues(searchVersion);
      return;
    }
    this.loadNearestVenues(searchVersion);
  }

  /**
   * ai-service xếp hạng (thói quen + khoảng cách + đánh giá) rồi lấy thẻ sân đầy đủ từ venue-service theo đúng thứ tự
   * đó. AI lỗi thì quay về danh sách gần nhất, không để trống mục này.
   */
  private loadRecommendedVenues(searchVersion: number): void {
    this.loading = true;
    this.ai.getVenueRecommendations(this.latitude!, this.longitude!, this.selectedSport!, this.appliedRadiusKm, 8).pipe(
      switchMap(picks => !Array.isArray(picks) || !picks.length ? of(null) : this.venueSearchRepo.searchVenues({
        ids: picks.map(pick => pick.venueId),
        page: 0,
        size: picks.length
      }).pipe(map(res => ({ picks, venues: res?.data?.items ?? [] })))),
      catchError(() => of(null)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(result => {
      if (searchVersion !== this.nearbySearchVersion) return;
      // AI lỗi hoặc không có gợi ý nào: vẫn hiện sân gần nhất thay vì để trống.
      if (!result?.venues.length) {
        this.loadNearestVenues(searchVersion);
        return;
      }
      const byId = new Map(result.venues.map(venue => [venue.venueId, venue] as const));
      this.featuredVenues = result.picks
        .filter(pick => byId.has(pick.venueId))
        .map(pick => ({ ...byId.get(pick.venueId)!, distanceKm: pick.distanceKm }));
      this.venueReasons = new Map(result.picks.map(pick => [pick.venueId, pick.matchReason] as const));
      this.loading = false;
    });
  }

  private loadNearestVenues(searchVersion: number): void {
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
    this.pickerAccuracyKm = this.locationAccuracyKm;
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
      this.zone.run(() => {
        this.pickerAccuracyKm = coarseAccuracyKm(position.coords.accuracy);
        this.updatePickerLocation(position.coords.latitude, position.coords.longitude, true);
      });
    }, undefined, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
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
    this.markPickerExact();
    this.updatePickerLocation(suggestion.latitude, suggestion.longitude, false);
  }

  confirmPickerLocation(): void {
    if (this.pendingLatitude == null || this.pendingLongitude == null) return;
    this.latitude = Number(this.pendingLatitude.toFixed(6));
    this.longitude = Number(this.pendingLongitude.toFixed(6));
    this.locationMessage = this.pendingLocationMessage || 'Vị trí đã chọn';
    this.locationState = 'ready';
    this.locationAccuracyKm = this.pickerAccuracyKm;
    // Chỉ nhớ vị trí người dùng thật sự đặt (ghim / tìm kiếm), không nhớ vị trí ước lượng theo mạng.
    if (this.pickerAccuracyKm == null) {
      this.saveLocation({ latitude: this.latitude, longitude: this.longitude, label: this.locationMessage });
    }
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

  private async resolveCurrentLocationName(latitude: number, longitude: number, retry = true): Promise<void> {
    let address: string | undefined;
    try {
      const response = await firstValueFrom(this.venueSearchRepo.reverseGeocode(latitude, longitude));
      address = response?.data?.address;
    } catch (error) {
      console.warn('Unable to resolve the current location name.', error);
    }
    // Bản đồ địa chỉ đôi khi đang khởi động lại: thử lại một lần, nếu người dùng chưa đổi sang vị trí khác.
    const stillHere = () => this.latitude === latitude && this.longitude === longitude;
    if (!address && retry) {
      setTimeout(() => { if (stillHere()) void this.resolveCurrentLocationName(latitude, longitude, false); }, 4000);
    }
    if (stillHere()) {
      this.zone.run(() => this.locationMessage = address || 'Vị trí hiện tại của bạn');
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
      this.markPickerExact();
      this.updatePickerLocation(event.latlng.lat, event.latlng.lng, true);
    }));
    this.mapResizeObserver = new ResizeObserver(() => this.map?.invalidateSize({ pan: false }));
    this.mapResizeObserver.observe(element);
    this.updateMapMarker();
    requestAnimationFrame(() => this.map?.invalidateSize({ pan: false }));
  }

  /** Đặt ghim bằng tay hay chọn kết quả tìm kiếm: vị trí chính xác, bỏ cảnh báo ước lượng. */
  private markPickerExact(): void {
    this.pickerAccuracyKm = null;
  }

  private restoreSavedLocation(): boolean {
    let saved: SavedLocation | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(SAVED_LOCATION_KEY) || 'null');
    } catch {
      return false;
    }
    if (!saved || !Number.isFinite(saved.latitude) || !Number.isFinite(saved.longitude)) return false;
    this.latitude = saved.latitude;
    this.longitude = saved.longitude;
    this.locationMessage = saved.label || 'Vị trí đã chọn';
    this.locationAccuracyKm = null;
    this.locationState = 'ready';
    this.loadNearbyVenues();
    return true;
  }

  private saveLocation(location: SavedLocation): void {
    try {
      localStorage.setItem(SAVED_LOCATION_KEY, JSON.stringify(location));
    } catch {
      // Trình duyệt chặn bộ nhớ (vd. chế độ riêng tư): chỉ không nhớ được cho lần sau.
    }
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

function coarseAccuracyKm(accuracyMeters: number | null | undefined): number | null {
  return accuracyMeters != null && accuracyMeters > COARSE_ACCURACY_METERS
    ? Math.max(2, Math.round(accuracyMeters / 1000))
    : null;
}
