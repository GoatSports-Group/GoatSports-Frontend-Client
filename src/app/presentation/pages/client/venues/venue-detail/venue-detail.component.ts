import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, interval, map, of, take } from 'rxjs';
import { VENUE_SEARCH_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-search.repository';
import { VENUE_FAVORITE_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-favorite.repository';
import { REVIEW_REPOSITORY_TOKEN } from '@application/ports/persistence/review.repository';
import { PublicVenueReview } from '@application/dto/review/review.dto';
import { SPORT_TYPE_OPTIONS, Venue, VenueCourt, VenueFacilityLayoutItem } from '@application/dto/venue/venue.dto';
import { TimeSlot, TimeSlotStatus, TIME_SLOT_STATUS_LABELS } from '@application/dto/booking/booking.dto';
import { GetStorageFileUrlUseCase } from '@application/usecase/storage/get-storage-file-url.usecase';
import { AuthService } from '@presentation/services/auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';
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
  private favoriteRepository = inject(VENUE_FAVORITE_REPOSITORY_TOKEN);
  private reviewRepository = inject(REVIEW_REPOSITORY_TOKEN);
  private getFileUrl = inject(GetStorageFileUrlUseCase);
  private authService = inject(AuthService);
  private notify = inject(NotifyService);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);

  readonly today = this.toLocalDate(new Date());
  readonly maxBookingDate = this.toLocalDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  readonly TimeSlotStatus = TimeSlotStatus;

  venueId = '';
  matchmakingSessionId = '';
  venue: Venue | null = null;
  venueImages: string[] = [VENUE_PLACEHOLDER_IMAGE];
  selectedCourt: VenueCourt | null = null;
  selectedSlot: TimeSlot | null = null;
  selectedDate = this.today;
  courtSlots: TimeSlot[] = [];
  loading = true;
  loadingSlots = false;
  detailError = '';
  slotsError = '';
  selectedImageIndex = 0;
  isFavorite = false;
  favoriteLoading = false;
  currentDateTime = new Date();
  activeTab: 'overview' | 'facility-layout' | 'reviews' = 'overview';
  reviews: PublicVenueReview[] = [];
  reviewsLoading = false;
  reviewsLoaded = false;
  reviewsError = '';

  readonly reviewStars = [1, 2, 3, 4, 5];

  get galleryImages(): string[] {
    return this.venueImages.slice(0, 5);
  }

  get bookingDates(): string[] {
    const start = new Date(`${this.selectedDate}T00:00:00`);
    const today = new Date(`${this.today}T00:00:00`);
    const offset = Math.min(2, Math.max(0, Math.floor((start.getTime() - today.getTime()) / 86400000)));
    const base = new Date(start.getTime() - offset * 86400000);
    return Array.from({ length: 5 }, (_, index) => this.toLocalDate(new Date(base.getTime() + index * 86400000)));
  }

  get morningSlots(): TimeSlot[] {
    return this.courtSlots.filter(slot => this.getSlotHour(slot) < 12);
  }

  get afternoonSlots(): TimeSlot[] {
    return this.courtSlots.filter(slot => {
      const hour = this.getSlotHour(slot);
      return hour >= 12 && hour < 18;
    });
  }

  get eveningSlots(): TimeSlot[] {
    return this.courtSlots.filter(slot => this.getSlotHour(slot) >= 18);
  }

  get selectedSubtotal(): number {
    return this.selectedSlot?.pricePerHour ?? 0;
  }

  get facilityItems(): VenueFacilityLayoutItem[] {
    const items = (this.venue?.facilityLayout?.items ?? []).filter(item => this.isBasicFacility(item));
    let wcIncluded = false;

    return items.flatMap(item => {
      if (item.type !== 'WC') return [item];
      if (wcIncluded) return [];

      wcIncluded = true;
      return [{ ...item, id: 'overview-wc', label: 'WC' }];
    });
  }

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
    if (isPlatformBrowser(this.platformId)) {
      interval(30_000)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.currentDateTime = new Date();
          if (this.selectedSlot && !this.isSlotAvailable(this.selectedSlot)) {
            this.selectedSlot = null;
          }
        });
    }

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
    this.activeTab = 'overview';
    this.reviews = [];
    this.reviewsLoaded = false;
    this.reviewsError = '';

    this.venueSearchRepo.getVenueDetails(this.venueId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: response => {
        this.venue = response?.data || null;
        this.resolveVenueImages(this.venue?.imageUrls ?? []);
        this.loadFavoriteStatus();

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
    this.selectedSlot = null;
    this.loadSlots();
  }

  onDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value) return;
    this.selectedDate = value < this.today ? this.today : value;
    this.selectedSlot = null;
    this.loadSlots();
  }

  selectBookingDate(value: string): void {
    if (value < this.today || value > this.maxBookingDate || value === this.selectedDate) return;
    this.selectedDate = value;
    this.selectedSlot = null;
    this.loadSlots();
  }

  loadSlots(): void {
    if (!this.selectedCourt) return;
    this.loadingSlots = true;
    this.slotsError = '';
    this.courtSlots = [];
    this.selectedSlot = null;

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
    if (this.isPastSlot(slot)) return 'Đã qua';
    return TIME_SLOT_STATUS_LABELS[slot.status] || slot.status;
  }

  isSlotAvailable(slot: TimeSlot): boolean {
    return slot.status === TimeSlotStatus.AVAILABLE && !this.isPastSlot(slot);
  }

  selectSlot(slot: TimeSlot): void {
    if (!this.isSlotAvailable(slot)) return;
    this.selectedSlot = this.selectedSlot?.timeSlotId === slot.timeSlotId ? null : slot;
  }

  getWeekdayLabel(value: string): string {
    const day = new Date(`${value}T00:00:00`).getDay();
    return day === 0 ? 'CN' : `T${day + 1}`;
  }

  isToday(value: string): boolean {
    return value === this.today;
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

  goToSelectedBooking(): void {
    if (!this.selectedCourt || !this.selectedSlot) return;
    this.goToBooking(this.selectedCourt, this.selectedSlot);
  }

  toggleFavorite(): void {
    if (this.favoriteLoading || !this.venue) return;
    if (!this.authService.isAuthenticated) {
      this.authService.notifyAuthenticationRequired('Vui lòng đăng nhập để lưu sân yêu thích.');
      return;
    }

    this.favoriteLoading = true;
    const request = this.isFavorite
      ? this.favoriteRepository.unfavorite(this.venue.venueId)
      : this.favoriteRepository.favorite(this.venue.venueId);
    request.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: status => {
        this.isFavorite = status.followed;
        this.favoriteLoading = false;
        this.notify.success(status.followed ? 'Đã lưu sân yêu thích.' : 'Đã bỏ lưu sân.');
      },
      error: () => {
        this.favoriteLoading = false;
        this.notify.error('Không thể cập nhật sân yêu thích. Vui lòng thử lại.');
      }
    });
  }

  async shareVenue(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const shareData = { title: this.venue?.name ?? 'GOAT Sports', url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.href);
        this.notify.success('Đã sao chép liên kết sân.');
      }
    } catch {
      // The native share sheet may be dismissed intentionally.
    }
  }

  hasAmenity(...keywords: string[]): boolean {
    const amenities = this.venue?.amenities.map(value => value.toLocaleLowerCase('vi')) ?? [];
    return amenities.some(amenity => keywords.some(keyword => amenity.includes(keyword)));
  }

  showTab(tab: 'overview' | 'facility-layout' | 'reviews'): void {
    this.activeTab = tab;
    if (tab === 'reviews' && !this.reviewsLoaded) this.loadReviews();
  }

  facilityIcon(item: VenueFacilityLayoutItem): string {
    const label = item.label.toLocaleLowerCase('vi');
    if (label.includes('tắm')) return 'droplets';
    const icons: Partial<Record<VenueFacilityLayoutItem['type'], string>> = {
      RECEPTION: 'store', ENTRANCE: 'arrow-right', PARKING: 'circle-parking', LOCKER: 'folder-open',
      WC: 'users', WAITING: 'clock', CAFE: 'cup-soda', STORAGE: 'inbox', CUSTOM: 'layout-grid'
    };
    return icons[item.type] ?? 'layout-grid';
  }

  private isBasicFacility(item: VenueFacilityLayoutItem): boolean {
    if (['LOCKER', 'WC', 'PARKING', 'CAFE'].includes(item.type)) return true;

    const label = item.label.toLocaleLowerCase('vi');
    return label.includes('phòng tắm') || label.includes('phòng thay đồ');
  }

  reviewDate(value: string): string {
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
      .format(new Date(value));
  }

  private toLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getSlotHour(slot: TimeSlot): number {
    return Number(slot.startTime.slice(0, 2));
  }

  private isPastSlot(slot: TimeSlot): boolean {
    const slotDate = slot.date || this.selectedDate;
    const currentDate = this.toLocalDate(this.currentDateTime);
    if (slotDate !== currentDate) return slotDate < currentDate;

    const [hour = 0, minute = 0] = slot.startTime.split(':').map(Number);
    const slotStartMinute = hour * 60 + minute;
    const currentMinute = this.currentDateTime.getHours() * 60 + this.currentDateTime.getMinutes();
    return slotStartMinute <= currentMinute;
  }

  private loadFavoriteStatus(): void {
    if (!this.venue || !this.authService.isAuthenticated) {
      this.isFavorite = false;
      return;
    }
    this.favoriteRepository.getStatus(this.venue.venueId).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      catchError(() => of({ venueId: this.venueId, followed: false }))
    ).subscribe(status => this.isFavorite = status.followed);
  }

  private loadReviews(): void {
    this.reviewsLoading = true;
    this.reviewsError = '';
    this.reviewRepository.getVenueReviews(this.venueId, 0, 20).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: response => {
        this.reviews = response?.data?.items ?? [];
        this.reviewsLoaded = true;
        this.reviewsLoading = false;
      },
      error: error => {
        this.reviewsError = error?.error?.message || 'Không thể tải đánh giá của sân.';
        this.reviewsLoading = false;
      }
    });
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
