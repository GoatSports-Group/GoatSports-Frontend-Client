import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { Venue } from '@application/dto/venue/venue.dto';
import { VENUE_FAVORITE_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-favorite.repository';
import { VENUE_SEARCH_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-search.repository';

/** venue-service nhan toi da 50 id moi lan. */
const IDS_PER_REQUEST = 50;

/**
 * /venues/saved — san nguoi choi da bam "Luu san". social-service chi tra id (moi luu truoc); trang lay
 * thong tin moi san tu venue-service (`ids`, lo 50) mot lan, chi giu san con hoat dong — so dem khop
 * voi so the — roi phan trang ngay tren may.
 */
@Component({
  selector: 'app-saved-venues',
  templateUrl: './saved-venues.component.html',
  styleUrls: ['./saved-venues.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class SavedVenuesComponent {
  private readonly favorites = inject(VENUE_FAVORITE_REPOSITORY_TOKEN);
  private readonly venueSearch = inject(VENUE_SEARCH_REPOSITORY_TOKEN);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('listTop') private listTop?: ElementRef<HTMLElement>;

  readonly pageSize = 12;
  readonly venues = signal<Venue[]>([]);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly total = computed(() => this.venues().length);
  readonly pagedVenues = computed(() => {
    const start = this.pageIndex() * this.pageSize;
    return this.venues().slice(start, start + this.pageSize);
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.favorites.getSaved().pipe(
      switchMap(saved => {
        const ids = saved.map(item => item.venueId);
        if (!ids.length) return of([] as Venue[]);
        const chunks = Array.from({ length: Math.ceil(ids.length / IDS_PER_REQUEST) },
          (_, index) => ids.slice(index * IDS_PER_REQUEST, (index + 1) * IDS_PER_REQUEST));
        return forkJoin(chunks.map(chunk =>
          this.venueSearch.searchVenues({ ids: chunk, page: 0, size: chunk.length }).pipe(
            map(response => response?.data?.items ?? [])))).pipe(
          map(pages => {
            const byId = new Map(pages.flat().map(venue => [venue.venueId, venue]));
            // venue-service khong giu thu tu id: sap lai theo thu tu da luu; san ngung hoat dong khong co trong ket qua.
            return ids.map(id => byId.get(id)).filter((venue): venue is Venue => !!venue);
          }));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: venues => {
        this.venues.set(venues);
        this.pageIndex.set(0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  changePage(index: number): void {
    this.pageIndex.set(index);
    const element = this.listTop?.nativeElement;
    if (element && element.getBoundingClientRect().top < 0) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Bo luu ngay tren the: the ke tiep truot len; trang rong thi lui mot trang. */
  onFavoriteChange(venueId: string, followed: boolean): void {
    if (followed) return;
    this.venues.update(items => items.filter(item => item.venueId !== venueId));
    const lastPage = Math.max(0, Math.ceil(this.total() / this.pageSize) - 1);
    this.pageIndex.set(Math.min(this.pageIndex(), lastPage));
  }
}
