import { Component, DestroyRef, Input, OnChanges, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, distinctUntilChanged, of, take } from 'rxjs';
import { Venue } from '@application/dto/venue/venue.dto';
import { SPORT_TYPE_OPTIONS } from '@application/dto/venue/venue.dto';
import { GetStorageFileUrlUseCase } from '@application/usecase/storage/get-storage-file-url.usecase';
import {
  isAbsoluteVenueImageUrl,
  VENUE_PLACEHOLDER_IMAGE
} from '@presentation/shared/utils/venue-media.utils';
import { VENUE_FAVORITE_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-favorite.repository';
import { AuthService } from '@presentation/services/auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';

@Component({
  selector: 'app-venue-card',
  templateUrl: './venue-card.component.html',
  styleUrls: ['./venue-card.component.scss'],
  standalone: false
})
export class VenueCardComponent implements OnInit, OnChanges {
  private readonly getFileUrl = inject(GetStorageFileUrlUseCase);
  private readonly favoriteRepository = inject(VENUE_FAVORITE_REPOSITORY_TOKEN);
  private readonly authService = inject(AuthService);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() venue!: Venue;
  @Input() homeStyle = false;
  primaryImage = VENUE_PLACEHOLDER_IMAGE;
  isFavorite = false;
  favoriteLoading = false;
  private currentImageKey = '';
  private favoriteVenueId = '';

  ngOnInit(): void {
    this.authService.isAuthenticated$.pipe(
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(authenticated => {
      if (authenticated) this.loadFavoriteStatus();
      else this.isFavorite = false;
    });
  }

  ngOnChanges(): void {
    this.resolvePrimaryImage(this.venue?.imageUrls?.[0]);
    this.loadFavoriteStatus();
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(VENUE_PLACEHOLDER_IMAGE)) {
      image.src = VENUE_PLACEHOLDER_IMAGE;
    }
  }

  getSportLabel(value: string): string {
    return SPORT_TYPE_OPTIONS.find(option => option.value === value)?.label || value;
  }

  formatPrice(price: number | null | undefined): string {
    if (price == null) return 'Liên hệ';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  }

  formatCompactPrice(price: number | null | undefined): string {
    if (price == null) return 'Liên hệ';
    return `${new Intl.NumberFormat('vi-VN').format(price)} đ`;
  }

  onFavoriteClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.favoriteLoading) return;

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

  private loadFavoriteStatus(): void {
    const venueId = this.venue?.venueId;
    if (!venueId || !this.authService.isAuthenticated || this.favoriteVenueId === venueId) return;

    this.favoriteVenueId = venueId;
    this.favoriteRepository.getStatus(venueId).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      catchError(() => {
        this.favoriteVenueId = '';
        return of({ venueId, followed: false });
      })
    ).subscribe(status => this.isFavorite = status.followed);
  }

  private resolvePrimaryImage(value?: string | null): void {
    const image = value?.trim() ?? '';
    this.currentImageKey = image;
    this.primaryImage = VENUE_PLACEHOLDER_IMAGE;
    if (!image) return;

    if (isAbsoluteVenueImageUrl(image)) {
      this.primaryImage = image;
      return;
    }

    this.getFileUrl.execute(image).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      catchError(() => of(''))
    ).subscribe(url => {
      if (this.currentImageKey !== image) return;
      const resolvedUrl = url.trim();
      this.primaryImage = isAbsoluteVenueImageUrl(resolvedUrl)
        ? resolvedUrl
        : VENUE_PLACEHOLDER_IMAGE;
    });
  }
}
