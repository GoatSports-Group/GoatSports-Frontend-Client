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
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { VENUE_SEARCH_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-search.repository';
import { SportType, SPORT_TYPE_OPTIONS, Venue } from '@application/dto/venue/venue.dto';

type LocationState = 'locating' | 'ready' | 'error' | 'unsupported';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  standalone: false
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  private router = inject(Router);
  private venueSearchRepo = inject(VENUE_SEARCH_REPOSITORY_TOKEN);
  private host = inject(ElementRef<HTMLElement>);
  private zone = inject(NgZone);
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);
  private animationContext?: ReturnType<typeof gsap.context>;

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
  radiusKm = 10;
  appliedRadiusKm = 10;
  radiusError = '';
  latitude?: number;
  longitude?: number;

  get hasCurrentLocation(): boolean {
    return this.latitude != null && this.longitude != null;
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

        gsap.utils.toArray<HTMLElement>('.section-heading, .venue-grid, .development-state').forEach(element => {
          gsap.from(element, {
            y: 28,
            duration: .65,
            ease: 'power3.out',
            scrollTrigger: { trigger: element, start: 'top 88%', once: true }
          });
        });
      }, this.host.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.animationContext?.revert();
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
        this.locationMessage = 'Vị trí hiện tại';
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
    if (!this.hasCurrentLocation) {
      this.featuredVenues = [];
      this.loading = false;
      return;
    }

    this.loading = true;
    this.venueSearchRepo.searchVenues({
      latitude: this.latitude,
      longitude: this.longitude,
      radiusKm: this.appliedRadiusKm,
      page: 0,
      size: 8
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.featuredVenues = (res?.data?.items || [])
          .filter(venue => venue.distanceKm != null && venue.distanceKm <= this.appliedRadiusKm)
          .sort((left, right) => (left.distanceKm ?? Infinity) - (right.distanceKm ?? Infinity))
          .slice(0, 4);
        this.loading = false;
      },
      error: err => {
        console.error('Error loading featured venues:', err);
        this.featuredVenues = [];
        this.loading = false;
      }
    });
  }

  applyRadius(): void {
    const requestedRadius = Number(this.radiusKm);
    if (!Number.isFinite(requestedRadius) || requestedRadius < 1 || requestedRadius > 100) {
      this.radiusError = 'Bán kính phải từ 1 đến 100 km.';
      return;
    }

    this.radiusError = '';
    this.radiusKm = requestedRadius;
    this.appliedRadiusKm = requestedRadius;
    this.loadNearbyVenues();
  }

  onSearch(): void {
    this.openVenueSearch();
  }

  selectSport(sportId: string): void {
    this.openVenueSearch(sportId);
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
}
