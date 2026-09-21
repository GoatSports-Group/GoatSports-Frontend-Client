import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule, LucideIconComponent],
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaginationComponent implements OnChanges {
  @Input({ required: true }) pageIndex = 0;
  @Input({ required: true }) pageSize = 10;
  @Input({ required: true }) totalItems = 0;
  @Input() itemLabel = 'kết quả';

  @Output() readonly pageChange = new EventEmitter<number>();

  totalPages = 1;
  visiblePages: Array<number | 'ellipsis'> = [];

  ngOnChanges(): void {
    this.totalPages = Math.max(1, Math.ceil(this.totalItems / this.pageSize));
    this.visiblePages = this.calculateVisiblePages();
  }

  get showingText(): string {
    if (this.totalItems === 0) return `Hiển thị 0 - 0 trong tổng số 0 ${this.itemLabel}`;
    const start = this.pageIndex * this.pageSize + 1;
    const end = Math.min((this.pageIndex + 1) * this.pageSize, this.totalItems);
    return `Hiển thị ${start} - ${end} trong tổng số ${this.totalItems} ${this.itemLabel}`;
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages && page !== this.pageIndex) {
      this.pageChange.emit(page);
    }
  }

  private calculateVisiblePages(): Array<number | 'ellipsis'> {
    const pages: Array<number | 'ellipsis'> = [0];
    let start = Math.max(1, this.pageIndex - 1);
    let end = Math.min(this.totalPages - 2, this.pageIndex + 1);

    if (this.pageIndex <= 2) end = Math.min(this.totalPages - 2, 3);
    if (this.pageIndex >= this.totalPages - 3) start = Math.max(1, this.totalPages - 4);

    if (start > 1) pages.push('ellipsis');
    for (let page = start; page <= end; page += 1) pages.push(page);
    if (end < this.totalPages - 2) pages.push('ellipsis');
    if (this.totalPages > 1) pages.push(this.totalPages - 1);

    return pages;
  }
}
