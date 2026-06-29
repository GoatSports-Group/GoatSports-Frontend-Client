import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { VenueService } from '@presentation/services/venue.service';
import { ReviewService } from '@presentation/services/review.service';
import { AuthService } from '@presentation/services/auth.service';
import { Venue, TimeSlot, SportType, VenueStatus, SPORT_TYPE_OPTIONS, VENUE_STATUS_OPTIONS } from '@application/dto/venue/venue.dto';
import { Review } from '@application/dto/review/review.dto';
import { MatSnackBar } from '@angular/material/snack-bar';

interface BookingDay {
  dateStr: string;
  dayLabel: string;
  dayOfMonth: number;
}

@Component({
  selector: 'app-venue-detail',
  templateUrl: './venue-detail.component.html',
  styleUrls: ['./venue-detail.component.scss']
})
export class VenueDetailComponent implements OnInit {
  private venueService = inject(VenueService);
  private reviewService = inject(ReviewService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  readonly VenueStatus = VenueStatus;
  readonly SportType = SportType;

  // Core Data
  venue: Venue | undefined;
  timeSlots: TimeSlot[] = [];
  reviews: Review[] = [];
  relatedVenues: Venue[] = [];

  // Interaction State
  loading = true;
  selectedDate: string = '';
  selectedSlot: TimeSlot | null = null;
  activeImage: string = '';
  bookingDays: BookingDay[] = [];

  // Review Form
  newRating = 5;
  newComment = '';
  submittingReview = false;

  ngOnInit() {
    this.generateBookingDays();
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.loadVenueDetails(id);
      }
    });

    // Check if redirecting directly to slot selection (from AI recommendation)
    this.route.queryParams.subscribe(params => {
      if (params['book'] === 'true') {
        setTimeout(() => {
          const element = document.getElementById('booking-calendar-section');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 800);
      }
    });
  }

  generateBookingDays() {
    const days: BookingDay[] = [];
    const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = i === 0 ? 'Hôm nay' : weekdays[d.getDay()];
      const dayOfMonth = d.getDate();
      days.push({ dateStr, dayLabel, dayOfMonth });
    }
    this.bookingDays = days;
    this.selectedDate = days[0].dateStr; // Default to today
  }

  loadVenueDetails(id: string) {
    this.loading = true;
    this.selectedSlot = null;

    this.venueService.getVenueById(id).subscribe(data => {
      this.venue = data;
      this.loading = false;

      if (data) {
        this.activeImage = data.imageUrl;
        this.loadSlots();
        this.loadReviews();
        this.loadRelatedVenues(data.sportType, data.venueId);
      }
    });
  }

  loadSlots() {
    if (!this.venue) return;
    this.venueService.getSlotsForVenue(this.venue.venueId, this.selectedDate).subscribe(slots => {
      this.timeSlots = slots;
      this.selectedSlot = null; // Reset slot selection when date changes
    });
  }

  loadReviews() {
    if (!this.venue) return;
    this.reviewService.getReviewsByVenue(this.venue.venueId).subscribe(data => {
      this.reviews = data;
    });
  }

  loadRelatedVenues(sportType: any, currentId: string) {
    this.venueService.getVenues({ sportType }).subscribe(list => {
      this.relatedVenues = list
        .filter(v => v.venueId !== currentId)
        .slice(0, 4);
    });
  }

  selectDate(dateStr: string) {
    this.selectedDate = dateStr;
    this.loadSlots();
  }

  selectSlot(slot: TimeSlot) {
    if (slot.isAvailable) {
      this.selectedSlot = slot;
    }
  }

  changeActiveImage(url: string) {
    this.activeImage = url;
  }

  submitReview(event: Event) {
    event.preventDefault();
    if (!this.venue) return;

    if (!this.authService.isAuthenticated) {
      this.snackBar.open('Vui lòng đăng nhập để gửi đánh giá!', 'Đăng nhập', {
        duration: 4000
      }).onAction().subscribe(() => {
        const clientUrl = import.meta.env.NG_APP_CLIENT_API_URL || 'http://localhost:4200';
        const authUrl = import.meta.env.NG_APP_AUTH_API_URL || 'http://localhost:4400';
        const currentUrl = encodeURIComponent(`${clientUrl}${this.router.url}`);
        window.location.href = `${authUrl}/login?redirect=${currentUrl}`;
      });
      return;
    }

    if (!this.newComment.trim()) {
      this.snackBar.open('Vui lòng nhập nội dung nhận xét!', 'Đóng', { duration: 3000 });
      return;
    }

    this.submittingReview = true;
    const user = this.authService.currentUser;
    const fullName = user?.fullName || 'Người chơi ẩn danh';

    this.reviewService.addReview(this.venue.venueId, this.newRating, this.newComment, fullName).subscribe({
      next: () => {
        this.snackBar.open('Cảm ơn bạn đã gửi đánh giá!', 'Đóng', {
          duration: 3000,
          panelClass: ['snackbar-success']
        });
        this.newComment = '';
        this.newRating = 5;
        this.submittingReview = false;
        this.loadReviews();
        // Reload venue details to refresh overall average rating
        this.venueService.getVenueById(this.venue!.venueId).subscribe(v => {
          if (v) this.venue!.rating = v.rating;
        });
      },
      error: () => {
        this.snackBar.open('Gửi đánh giá thất bại!', 'Đóng', { duration: 3000 });
        this.submittingReview = false;
      }
    });
  }

  bookCourt() {
    if (!this.venue || !this.selectedSlot) return;

    if (!this.authService.isAuthenticated) {
      this.snackBar.open('Vui lòng đăng nhập để tiến hành đặt sân!', 'Đăng nhập', {
        duration: 4000
      }).onAction().subscribe(() => {
        const clientUrl = import.meta.env.NG_APP_CLIENT_API_URL || 'http://localhost:4200';
        const authUrl = import.meta.env.NG_APP_AUTH_API_URL || 'http://localhost:4400';
        const currentUrl = encodeURIComponent(`${clientUrl}${this.router.url}`);
        window.location.href = `${authUrl}/login?redirect=${currentUrl}`;
      });
      return;
    }

    this.router.navigate(['/booking'], {
      queryParams: {
        venueId: this.venue.venueId,
        date: this.selectedDate,
        time: this.selectedSlot.time,
        price: this.selectedSlot.price
      }
    });
  }

  getStatusLabel(status?: string): string {
    if (!status) return '';
    return VENUE_STATUS_OPTIONS.find(o => o.value === status)?.label || status;
  }

  getSportTypeLabel(type: string): string {
    const key = type.toUpperCase();
    return SPORT_TYPE_OPTIONS.find(o => o.value === key || o.value === type)?.label || type;
  }
}
