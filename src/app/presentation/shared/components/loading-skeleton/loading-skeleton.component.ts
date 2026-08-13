import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-loading-skeleton',
    templateUrl: './loading-skeleton.component.html',
    styleUrls: ['./loading-skeleton.component.scss'],
    standalone: false
})
export class LoadingSkeletonComponent {
  @Input() type: 'card' | 'list' | 'detail' = 'card';
  @Input() count: number = 1;

  get countArray(): number[] {
    return Array(this.count).fill(0);
  }
}
