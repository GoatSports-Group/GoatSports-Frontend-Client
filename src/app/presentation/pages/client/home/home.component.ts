import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { VENUE_SEARCH_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-search.repository';
import { Venue, SportType, SPORT_TYPE_OPTIONS } from '@application/dto/venue/venue.dto';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  standalone: false
})
export class HomeComponent implements OnInit {
  private router = inject(Router);
  private venueSearchRepo = inject(VENUE_SEARCH_REPOSITORY_TOKEN);

  readonly SportType = SportType;
  sportTypes = Object.values(SportType);

  featuredVenues: Venue[] = [];
  searchQuery: string = '';
  sportType: string = 'all';
  loading = true;

  getSportIcon(type: SportType): string {
    switch (type) {
      case SportType.SOCCER: return 'trophy';
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
      case SportType.SOCCER: return '#ecfdf5';
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

  loadHomeData(): void {
    this.loading = true;
    this.venueSearchRepo.searchVenues({ page: 0, size: 6 }).subscribe({
      next: res => {
        this.featuredVenues = res?.data?.result || [];
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
