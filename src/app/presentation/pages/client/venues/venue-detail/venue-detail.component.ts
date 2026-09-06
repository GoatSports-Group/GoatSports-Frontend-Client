import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { VENUE_SEARCH_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-search.repository';
import { Venue, VenueCourt } from '@application/dto/venue/venue.dto';
import { TimeSlot } from '@application/dto/booking/booking.dto';

@Component({
  selector: 'app-venue-detail',
  templateUrl: './venue-detail.component.html',
  styleUrls: ['./venue-detail.component.scss'],
  standalone: false
})
export class VenueDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private venueSearchRepo = inject(VENUE_SEARCH_REPOSITORY_TOKEN);

  venueId: string = '';
  venue: Venue | null = null;
  selectedCourt: VenueCourt | null = null;
  selectedDate: string = new Date().toISOString().split('T')[0];
  courtSlots: TimeSlot[] = [];
  loading = true;
  loadingSlots = false;
  selectedImageIndex = 0;

  defaultImages = [
    'https://images.unsplash.com/photo-1542652694-40abf526446e?w=800&q=80',
    'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=80',
    'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&q=80'
  ];

  amenityIcons: Record<string, string> = {
    'Bãi đỗ xe': 'building-2',
    'Wifi': 'globe',
    'Đèn chiếu sáng': 'sun',
    'Căn tin nước uống': 'droplets',
    'Phòng thay đồ': 'shield-check',
    'Trọng tài': 'award'
  };

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.venueId = params['id'];
      if (this.venueId) {
        this.loadVenueDetails();
      }
    });
  }

  loadVenueDetails(): void {
    this.loading = true;
    this.venueSearchRepo.getVenueDetails(this.venueId).subscribe({
      next: res => {
        if (res?.data) {
          this.venue = res.data;
          if (this.venue.courts && this.venue.courts.length > 0) {
            this.selectCourt(this.venue.courts[0]);
          }
        }
        this.loading = false;
      },
      error: err => {
        console.error('Error loading venue detail:', err);
        this.loading = false;
      }
    });
  }

  selectCourt(court: VenueCourt): void {
    this.selectedCourt = court;
    this.loadSlots();
  }

  onDateChange(event: any): void {
    this.selectedDate = event.target.value;
    this.loadSlots();
  }

  loadSlots(): void {
    if (!this.selectedCourt) return;
    this.loadingSlots = true;
    this.venueSearchRepo.getCourtSlots(this.selectedCourt.venueCourtId, this.selectedDate).subscribe({
      next: res => {
        this.courtSlots = res?.data || [];
        this.loadingSlots = false;
      },
      error: err => {
        console.error('Error loading slots:', err);
        this.courtSlots = [];
        this.loadingSlots = false;
      }
    });
  }

  getImages(): string[] {
    if (this.venue?.imageUrls && this.venue.imageUrls.length > 0) {
      return this.venue.imageUrls;
    }
    return this.defaultImages;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  }

  goToBooking(court: VenueCourt, slot?: TimeSlot): void {
    this.router.navigate(['/booking/create'], {
      queryParams: {
        venueId: this.venue?.venueId,
        courtId: court.venueCourtId,
        date: this.selectedDate,
        startTime: slot ? slot.startTime : '18:00:00',
        endTime: slot ? slot.endTime : '19:00:00'
      }
    });
  }
}
