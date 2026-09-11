import { Component, DestroyRef, Input, OnChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, take } from 'rxjs';
import { Venue } from '@application/dto/venue/venue.dto';
import { SPORT_TYPE_OPTIONS } from '@application/dto/venue/venue.dto';
import { GetStorageFileUrlUseCase } from '@application/usecase/storage/get-storage-file-url.usecase';
import {
  isAbsoluteVenueImageUrl,
  VENUE_PLACEHOLDER_IMAGE
} from '@presentation/shared/utils/venue-media.utils';

@Component({
  selector: 'app-venue-card',
  templateUrl: './venue-card.component.html',
  styleUrls: ['./venue-card.component.scss'],
  standalone: false
})
export class VenueCardComponent implements OnChanges {
  private readonly getFileUrl = inject(GetStorageFileUrlUseCase);
  private readonly destroyRef = inject(DestroyRef);

  @Input() venue!: Venue;
  @Input() homeStyle = false;
  primaryImage = VENUE_PLACEHOLDER_IMAGE;
  private currentImageKey = '';

  ngOnChanges(): void {
    this.resolvePrimaryImage(this.venue?.imageUrls?.[0]);
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
