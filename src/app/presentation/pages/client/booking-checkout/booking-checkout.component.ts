import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { VenueService } from '@presentation/services/venue.service';
import { BookingService } from '@presentation/services/booking.service';
import { AuthService } from '@presentation/services/auth.service';
import { Venue, SportType } from '@application/dto/venue/venue.dto';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-booking-checkout',
  templateUrl: './booking-checkout.component.html',
  styleUrls: ['./booking-checkout.component.scss']
})
export class BookingCheckoutComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private venueService = inject(VenueService);
  private bookingService = inject(BookingService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  checkoutForm!: FormGroup;
  venue: Venue | undefined;

  // Slot parameters
  venueId = '';
  bookingDate = '';
  timeSlot = '';
  pricePerHour = 0;

  // Prices receipt
  subtotal = 0;
  serviceFee = 10000; // 10,000 VND processing fee
  discount = 0;
  totalPrice = 0;

  loading = false;
  bookingCompleted = false;

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.venueId = params['venueId'] || '';
      this.bookingDate = params['date'] || '';
      this.timeSlot = params['time'] || '';
      this.pricePerHour = Number(params['price']) || 0;

      if (!this.venueId || !this.bookingDate || !this.timeSlot) {
        this.snackBar.open('Vui lòng chọn sân và khung giờ trước khi đặt!', 'Đóng', { duration: 3000 });
        this.router.navigate(['/venues']);
        return;
      }

      this.loadVenueAndPricing();
    });

    // Initialize delivery reactive form
    const currentUser = this.authService.currentUser;
    this.checkoutForm = this.fb.group({
      fullName: [currentUser?.fullName || '', [Validators.required, Validators.minLength(4)]],
      email: [currentUser?.email || '', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^(0[3|5|7|8|9])+([0-9]{8})$/)]],
      numberOfPlayers: [4, [Validators.required, Validators.min(1), Validators.max(30)]],
      notes: ['']
    });
  }

  loadVenueAndPricing() {
    this.venueService.getVenueById(this.venueId).subscribe(data => {
      this.venue = data;
      if (!data) {
        this.snackBar.open('Sân thể thao không hợp lệ!', 'Đóng', { duration: 3000 });
        this.router.navigate(['/venues']);
        return;
      }

      this.subtotal = this.pricePerHour;
      this.totalPrice = this.subtotal + this.serviceFee;
    });
  }

  onSubmit() {
    if (this.checkoutForm.invalid || !this.venue) return;

    this.loading = true;

    const bookingPayload = {
      venueId: this.venue.venueId,
      venueName: this.venue.name,
      venueImage: this.venue.imageUrl,
      sportType: this.venue.sportType,
      bookingDate: this.bookingDate,
      timeSlot: this.timeSlot,
      fullName: this.checkoutForm.value.fullName,
      phone: this.checkoutForm.value.phone,
      email: this.checkoutForm.value.email,
      totalPrice: this.totalPrice,
      numberOfPlayers: this.checkoutForm.value.numberOfPlayers,
      notes: this.checkoutForm.value.notes
    };

    this.bookingService.createBooking(bookingPayload).subscribe({
      next: () => {
        this.loading = false;
        this.bookingCompleted = true;

        this.snackBar.open('Đặt sân thành công! Sân đấu đã được giữ chỗ.', 'Đóng', {
          duration: 4000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-success']
        });

        // Redirect to booking history
        this.router.navigate(['/my-bookings']);
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Đặt sân thất bại. Vui lòng thử lại!', 'Đóng', {
          duration: 4000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-error']
        });
      }
    });
  }

  continueBrowsing() {
    this.router.navigate(['/venues']);
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
