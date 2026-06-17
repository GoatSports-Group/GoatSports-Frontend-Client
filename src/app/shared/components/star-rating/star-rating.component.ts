import { Component, Input, OnChanges } from '@angular/core';

@Component({
  selector: 'app-star-rating',
  templateUrl: './star-rating.component.html',
  styleUrls: ['./star-rating.component.scss']
})
export class StarRatingComponent implements OnChanges {
  @Input() rating: number = 0;
  @Input() maxRating: number = 5;
  @Input() size: 'small' | 'medium' | 'large' = 'medium';

  stars: ('full' | 'half' | 'empty')[] = [];

  ngOnChanges() {
    this.calculateStars();
  }

  private calculateStars() {
    const list: ('full' | 'half' | 'empty')[] = [];
    const roundedRating = Math.round(this.rating * 2) / 2; // round to nearest 0.5
    
    for (let i = 1; i <= this.maxRating; i++) {
      if (i <= roundedRating) {
        list.push('full');
      } else if (i - 0.5 === roundedRating) {
        list.push('half');
      } else {
        list.push('empty');
      }
    }
    this.stars = list;
  }
}
