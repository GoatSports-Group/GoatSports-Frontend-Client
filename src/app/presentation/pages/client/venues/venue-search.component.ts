import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { VENUE_SEARCH_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-search.repository';
import { Venue, VenueSearchFilter, SportType, SPORT_TYPE_OPTIONS } from '@application/dto/venue/venue.dto';

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

  sportTypes = SPORT_TYPE_OPTIONS;
  venues: Venue[] = [];
  loading = true;
  totalVenues = 0;
  currentPage = 0;
  pageSize = 12;

  filter: VenueSearchFilter = {
    keyword: '',
    sportType: 'all',
    district: '',
    city: 'Hồ Chí Minh',
    minPrice: undefined,
    maxPrice: undefined,
    minRating: undefined,
    page: 0,
    size: 12
  };

  districts = [
    'Tất cả quận',
    'Quận 1',
    'Quận 3',
    'Quận 7',
    'Quận 10',
    'Quận Bình Thạnh',
    'Quận Phú Nhuận',
    'Quận Tân Bình',
    'TP. Thủ Đức'
  ];

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['sportType']) this.filter.sportType = params['sportType'];
      if (params['keyword']) this.filter.keyword = params['keyword'];
      if (params['district']) this.filter.district = params['district'];
      this.loadVenues();
    });
  }

  loadVenues(): void {
    this.loading = true;
    this.venueSearchRepo.searchVenues({
      ...this.filter,
      page: this.currentPage,
      size: this.pageSize
    }).subscribe({
      next: res => {
        if (res?.data) {
          this.venues = res.data.result || [];
          this.totalVenues = res.data.meta?.total || 0;
        } else {
          this.venues = [];
          this.totalVenues = 0;
        }
        this.loading = false;
      },
      error: err => {
        console.error('Error loading venues:', err);
        this.venues = [];
        this.loading = false;
      }
    });
  }

  onFilterChange(): void {
    this.currentPage = 0;
    this.loadVenues();
  }

  selectSport(sportValue: string): void {
    this.filter.sportType = this.filter.sportType === sportValue ? 'all' : sportValue;
    this.onFilterChange();
  }

  resetFilters(): void {
    this.filter = {
      keyword: '',
      sportType: 'all',
      district: '',
      city: 'Hồ Chí Minh',
      minPrice: undefined,
      maxPrice: undefined,
      minRating: undefined,
      page: 0,
      size: 12
    };
    this.onFilterChange();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadVenues();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
