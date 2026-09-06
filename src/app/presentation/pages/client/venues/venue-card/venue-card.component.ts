import { Component, Input } from '@angular/core';
import { Venue } from '@application/dto/venue/venue.dto';

@Component({
  selector: 'app-venue-card',
  templateUrl: './venue-card.component.html',
  styleUrls: ['./venue-card.component.scss'],
  standalone: false
})
export class VenueCardComponent {
  @Input() venue!: Venue;

  getDefaultImage(): string {
    return 'https://images.unsplash.com/photo-1542652694-40abf526446e?w=600&q=80';
  }

  getPrimaryImage(): string {
    if (this.venue?.imageUrls && this.venue.imageUrls.length > 0) {
      return this.venue.imageUrls[0];
    }
    return this.getDefaultImage();
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  }
}
