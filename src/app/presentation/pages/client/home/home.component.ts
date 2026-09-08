import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { Router } from '@angular/router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { VENUE_SEARCH_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-search.repository';
import { Venue, SportType, SPORT_TYPE_OPTIONS } from '@application/dto/venue/venue.dto';

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
  private animationContext?: ReturnType<typeof gsap.context>;

  readonly SportType = SportType;
  sportTypes = Object.values(SportType);

  featuredVenues: Venue[] = [];
  searchQuery: string = '';
  sportType: string = 'all';
  loading = true;

  getSportIcon(type: SportType): string {
    switch (type) {
      case SportType.FOOTBALL: return 'trophy';
      case SportType.BADMINTON: return 'target';
      case SportType.TENNIS: return 'activity';
      case SportType.PICKLEBALL: return 'swords';
      case SportType.BASKETBALL: return 'flame';
      case SportType.VOLLEYBALL: return 'award';
      default: return 'activity';
    }
  }

  getSportColor(type: SportType): string {
    switch (type) {
      case SportType.FOOTBALL: return '#ecfdf5';
      case SportType.BADMINTON: return '#f0f9ff';
      case SportType.TENNIS: return '#fef3c7';
      case SportType.PICKLEBALL: return '#ecfdf5';
      case SportType.BASKETBALL: return '#fff1f2';
      case SportType.VOLLEYBALL: return '#faf5ff';
      default: return '#f7fafc';
    }
  }

  ngOnInit(): void {
    this.loadHomeData();
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

        gsap.utils.toArray<HTMLElement>('.section-heading, .play-network__lead, .network-card').forEach(element => {
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

  loadHomeData(): void {
    this.loading = true;
    this.venueSearchRepo.searchVenues({ page: 0, size: 6 }).subscribe({
      next: res => {
        this.featuredVenues = res?.data?.items || [];
        this.loading = false;
      },
      error: err => {
        console.error('Error loading featured venues:', err);
        this.featuredVenues = [];
        this.loading = false;
      }
    });
  }

  onSearch(): void {
    const queryParams: any = {};
    if (this.searchQuery) queryParams.keyword = this.searchQuery;
    if (this.sportType && this.sportType !== 'all') queryParams.sportType = this.sportType;
    this.router.navigate(['/venues'], { queryParams });
  }

  viewVenue(venueId: string): void {
    this.router.navigate(['/venues', venueId]);
  }

  selectSport(sportId: string): void {
    this.router.navigate(['/venues'], { queryParams: { sportType: sportId } });
  }
}
