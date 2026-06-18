import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { VenueService } from '../../../services/venue.service';
import { AuthService } from '../../../services/auth.service';
import { Venue, VenueFilter, VenueSort } from '../../../../domain/entities/venue';
import { SportType } from '../../../../domain/enums/sport-type.enum';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageEvent } from '@angular/material/paginator';

@Component({
  selector: 'app-venue-list',
  templateUrl: './venue-list.component.html',
  styleUrls: ['./venue-list.component.scss']
})
export class VenueListComponent implements OnInit {
  private venueService = inject(VenueService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  // Venue catalog data
  venues: Venue[] = [];
  pagedVenues: Venue[] = [];

  // States
  loading = true;
  showMobileFilter = false;
  readonly SportType = SportType;

  // Filter state
  activeFilters: VenueFilter = {
    sportType: '',
    minPrice: 50000,
    maxPrice: 300000,
    area: '',
    rating: 0,
    searchTerm: ''
  };

  // Sorting state
  activeSort: VenueSort = 'rating-desc';

  // Pagination state
  pageSize = 6;
  currentPage = 0;
  totalVenues = 0;

  ngOnInit() {
    // Subscribe to query parameters to apply search or category filter from URL
    this.route.queryParams.subscribe(params => {
      this.activeFilters.searchTerm = params['search'] || '';
      this.activeFilters.sportType = params['sportType'] || '';
      this.currentPage = 0; // reset page
      this.fetchVenues();
    });
  }

  fetchVenues() {
    this.loading = true;

    // Fetch venues based on filters and sorting
    this.venueService.getVenues(this.activeFilters, this.activeSort).subscribe(data => {
      this.venues = data;
      this.totalVenues = this.venues.length;
      this.updatePagedVenues();
      this.loading = false;
    });
  }

  applyFilters() {
    this.currentPage = 0;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        sportType: this.activeFilters.sportType || null,
        search: this.activeFilters.searchTerm || null
      },
      queryParamsHandling: 'merge'
    });

    this.fetchVenues();
  }

  resetFilters() {
    this.activeFilters = {
      sportType: '',
      minPrice: 50000,
      maxPrice: 300000,
      area: '',
      rating: 0,
      searchTerm: ''
    };
    this.activeSort = 'rating-desc';
    this.currentPage = 0;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        sportType: null,
        search: null
      }
    });

    this.fetchVenues();
  }

  updatePagedVenues() {
    const startIndex = this.currentPage * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.pagedVenues = this.venues.slice(startIndex, endIndex);
  }

  onPageChange(event: PageEvent) {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePagedVenues();

    // Scroll to top of catalog smoothly
    window.scrollTo({ top: 150, behavior: 'smooth' });
  }

  viewDetail(venueId: string) {
    this.router.navigate(['/venue', venueId]);
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
