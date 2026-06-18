import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { VenueService } from '../../../services/venue.service';
import { AuthService } from '../../../services/auth.service';
import { Venue } from '../../../../domain/entities/venue';
import { SportType } from '../../../../domain/enums/sport-type.enum';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  private venueService = inject(VenueService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  readonly SportType = SportType;
  sportTypes = Object.values(SportType);

  getSportIcon(type: SportType): string {
    switch (type) {
      case SportType.SOCCER: return 'sports_soccer';
      case SportType.BADMINTON: return 'sports_tennis';
      case SportType.TENNIS: return 'sports_tennis';
      case SportType.PICKLEBALL: return 'sports_handball';
      case SportType.BASKETBALL: return 'sports_basketball';
      case SportType.VOLLEYBALL: return 'sports_volleyball';
      default: return 'sports';
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


  featuredVenues: Venue[] = [];
  searchQuery: string = '';
  sportType: string = 'all';
  loading = true;

  ngOnInit() {
    this.loadHomeData();
  }

  loadHomeData() {
    this.loading = true;
    // Load top rated or featured venues
    this.venueService.getVenues({}, 'rating-desc').subscribe({
      next: (venues) => {
        this.featuredVenues = venues.slice(0, 4);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onSearch() {
    const queryParams: any = {};
    if (this.searchQuery.trim()) {
      queryParams.search = this.searchQuery.trim();
    }
    if (this.sportType && this.sportType !== 'all') {
      queryParams.sportType = this.sportType;
    }
    this.router.navigate(['/venues'], { queryParams });
  }

  viewVenue(venueId: string) {
    this.router.navigate(['/venue', venueId]);
  }

  selectSport(sportId: string) {
    this.router.navigate(['/venues'], {
      queryParams: { sportType: sportId }
    });
  }

  getSportTypeLabel(type: string): string {
    switch (type) {
      case 'soccer': return SportType.SOCCER;
      case 'badminton': return SportType.BADMINTON;
      case 'tennis': return SportType.TENNIS;
      case 'pickleball': return SportType.PICKLEBALL;
      case 'basketball': return SportType.BASKETBALL;
      case 'volleyball': return SportType.VOLLEYBALL;
      default: return type;
    }
  }
}
