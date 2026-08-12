import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SportType } from '@application/dto/venue/venue.dto';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss'],
    standalone: false
})
export class HomeComponent implements OnInit {
  private router = inject(Router);

  readonly SportType = SportType;
  sportTypes = Object.values(SportType);

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

  featuredVenues: any[] = [];
  searchQuery: string = '';
  sportType: string = 'all';
  loading = true;

  ngOnInit() {
    this.loadHomeData();
  }

  loadHomeData() {
    this.loading = false;
    this.featuredVenues = [];
  }

  onSearch() {
    // No-op
  }

  viewVenue(venueId: string) {
    // No-op
  }

  selectSport(sportId: string) {
    // No-op
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
