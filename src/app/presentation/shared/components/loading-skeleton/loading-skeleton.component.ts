import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Skeleton placeholders that mirror the final layout (GOAT-DESIGN.md §6 Loading states).
 * - block:  one shape (`width` × `height`, `radius`) — for bespoke layouts.
 * - text:   `lines` lines of copy, the last one shorter.
 * - rows:   list rows in one card (icon · two lines · trailing chip) — notifications, requests, bookings.
 * - cards:  grid of media cards (`count`, `minWidth`) — venues, clubs, profiles.
 * - table:  card with a header row and `count` rows × `columns` cells.
 * - stats:  row of KPI tiles.
 * - info:   one card of label/value cells (settings info groups).
 * - detail: hero + 2/3 main column + 1/3 rail — detail pages.
 */
export type SkeletonVariant = 'block' | 'text' | 'rows' | 'cards' | 'table' | 'stats' | 'info' | 'detail';

@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  templateUrl: './loading-skeleton.component.html',
  styleUrls: ['./loading-skeleton.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingSkeletonComponent {
  @Input() variant: SkeletonVariant = 'block';
  @Input() count = 3;
  @Input() columns = 4;
  @Input() lines = 3;
  @Input() width = '100%';
  @Input() height = '16px';
  @Input() radius = '12px';
  @Input() minWidth = '280px';
  /** Screen-reader text; the shapes themselves are hidden from assistive tech. */
  @Input() label = 'Đang tải nội dung';
  /** Cards variant: 16:9 cover image (off for icon-led cards such as sport profiles). */
  @Input() media = true;
  /** Drop the skeleton's own card frame when it sits inside an existing card or table cell. */
  @Input() flush = false;
  /** Table variant: render the header row (off when the real <thead> is already on screen). */
  @Input() head = true;
  /** Inside a parent that already announces loading (role="status"), render shapes only. */
  @Input() decorative = false;

  get items(): number[] {
    return Array.from({ length: Math.max(1, this.count) }, (_, index) => index);
  }

  get cells(): number[] {
    return Array.from({ length: Math.max(1, this.columns) }, (_, index) => index);
  }

  /** First column wider (names/titles); CSS repeat() can't take a calc() count, so it's built here. */
  get tableColumns(): string {
    const rest = Math.max(0, this.columns - 1);
    return rest ? `minmax(0, 1.6fr) repeat(${rest}, minmax(0, 1fr))` : 'minmax(0, 1fr)';
  }

  get textLines(): number[] {
    return Array.from({ length: Math.max(1, this.lines) }, (_, index) => index);
  }
}
