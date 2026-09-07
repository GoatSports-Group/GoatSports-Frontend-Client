import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, map, of, take } from 'rxjs';
import { VENUE_SEARCH_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-search.repository';
import { SPORT_TYPE_OPTIONS, Venue, VenueCourt } from '@application/dto/venue/venue.dto';
import { TimeSlot, TimeSlotStatus, TIME_SLOT_STATUS_LABELS } from '@application/dto/booking/booking.dto';
import { GetStorageFileUrlUseCase } from '@application/usecase/storage/get-storage-file-url.usecase';
import {
  isAbsoluteVenueImageUrl,
  VENUE_PLACEHOLDER_IMAGE
} from '@presentation/shared/utils/venue-media.utils';

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
  private getFileUrl = inject(GetStorageFileUrlUseCase);
  private destroyRef = inject(DestroyRef);

  readonly today = this.toLocalDate(new Date());
  readonly maxBookingDate = this.toLocalDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  readonly TimeSlotStatus = TimeSlotStatus;

  venueId = '';
  matchmakingSessionId = '';
  venue: Venue | null = null;
  venueImages: string[] = [VENUE_PLACEHOLDER_IMAGE];
  selectedCourt: VenueCourt | null = null;
  selectedDate = this.today;
  courtSlots: TimeSlot[] = [];
  loading = true;
  loadingSlots = false;
  detailError = '';
  slotsError = '';
  selectedImageIndex = 0;

  readonly amenityIcons: Record<string, string> = {
    'Bãi đỗ xe': 'circle-parking',
    'Wifi': 'wifi',
    'Đèn chiếu sáng': 'sun',
    'Căn tin nước uống': 'cup-soda',
    'Nước uống': 'cup-soda',
    'Phòng thay đồ': 'shirt',
    'Trọng tài': 'badge-check'
  };

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.venueId = params.get('id') || '';
        this.matchmakingSessionId = this.route.snapshot.queryParamMap.get('matchmakingSessionId') || '';
        const requestedDate = this.route.snapshot.queryParamMap.get('date');
        if (requestedDate && requestedDate >= this.today) this.selectedDate = requestedDate;
        if (this.venueId) this.loadVenueDetails();
      });
  }

  loadVenueDetails(): void {
    this.loading = true;
    this.detailError = '';
    this.venue = null;
    this.selectedCourt = null;
    this.courtSlots = [];
    this.venueImages = [VENUE_PLACEHOLDER_IMAGE];
    this.selectedImageIndex = 0;

    this.venueSearchRepo.getVenueDetails(this.venueId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: response => {
        this.venue = response?.data || null;
        this.resolveVenueImages(this.venue?.imageUrls ?? []);

        const firstActiveCourt = this.venue?.courts?.find(court => court.active);
        if (firstActiveCourt) this.selectCourt(firstActiveCourt);
        this.loading = false;
      },
      error: error => {
        console.error('Error loading venue detail:', error);
        this.detailError = error?.error?.message || 'Không thể tải thông tin sân. Vui lòng thử lại.';
        this.loading = false;
      }
    });
  }

  selectCourt(court: VenueCourt): void {
    if (!court.active) return;
    this.selectedCourt = court;
    this.loadSlots();
  }

  onDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value) return;
    this.selectedDate = value < this.today ? this.today : value;
    this.loadSlots();
  }

  loadSlots(): void {
    if (!this.selectedCourt) return;
    this.loadingSlots = true;
    this.slotsError = '';
    this.courtSlots = [];

    this.venueSearchRepo.getCourtSlots(this.selectedCourt.venueCourtId, this.selectedDate)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: response => {
        this.courtSlots = (response?.data || []).sort((a, b) => a.startTime.localeCompare(b.startTime));
        this.loadingSlots = false;
      },
      error: error => {
        console.error('Error loading slots:', error);
        this.slotsError = error?.error?.message || 'Không thể tải lịch trống của sân này.';
        this.loadingSlots = false;
      }
    });
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(VENUE_PLACEHOLDER_IMAGE)) {
      image.src = VENUE_PLACEHOLDER_IMAGE;
    }
  }

  formatPrice(price: number | null | undefined): string {
    if (price == null) return 'Liên hệ';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  }

  formatTime(value?: string | null): string {
    return value ? value.slice(0, 5) : '--:--';
  }

  getSportLabel(value: string): string {
    return SPORT_TYPE_OPTIONS.find(option => option.value === value)?.label || value;
  }

  getSlotStatus(slot: TimeSlot): string {
    return TIME_SLOT_STATUS_LABELS[slot.status] || slot.status;
  }

  isSlotAvailable(slot: TimeSlot): boolean {
    return slot.status === TimeSlotStatus.AVAILABLE;
  }

  get mapUrl(): string | null {
    if (!this.venue) return null;
    if (this.venue.latitude != null && this.venue.longitude != null) {
      return `https://www.google.com/maps/search/?api=1&query=${this.venue.latitude},${this.venue.longitude}`;
    }
    const address = [this.venue.address, this.venue.district, this.venue.city].filter(Boolean).join(', ');
    return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
  }

  get fullAddress(): string {
    if (!this.venue) return '';
    return this.venue.address
      || [this.venue.ward, this.venue.district, this.venue.city].filter(Boolean).join(', ');
  }

  goToBooking(court: VenueCourt, slot: TimeSlot): void {
    if (!this.isSlotAvailable(slot)) return;
    this.router.navigate(['/booking/create'], {
      queryParams: {
        venueId: this.venue?.venueId,
        courtId: court.venueCourtId,
        timeSlotId: slot.timeSlotId,
        date: this.selectedDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        pricePerHour: slot.pricePerHour,
        matchmakingSessionId: this.matchmakingSessionId || null
      }
    });
  }

  private toLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private resolveVenueImages(values: readonly string[]): void {
    const venueId = this.venueId;
    const images = [...new Set(values.map(value => value?.trim()).filter(Boolean))] as string[];
    if (!images.length) {
      this.venueImages = [VENUE_PLACEHOLDER_IMAGE];
      return;
    }

    forkJoin(images.map(image => isAbsoluteVenueImageUrl(image)
      ? of(image)
      : this.getFileUrl.execute(image).pipe(
          take(1),
          map(url => url.trim()),
          catchError(() => of(''))
        )
    )).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(urls => {
      if (this.venueId !== venueId) return;
      const resolvedUrls = urls.filter(isAbsoluteVenueImageUrl);
      this.venueImages = resolvedUrls.length ? resolvedUrls : [VENUE_PLACEHOLDER_IMAGE];
      this.selectedImageIndex = 0;
    });
  }
}
