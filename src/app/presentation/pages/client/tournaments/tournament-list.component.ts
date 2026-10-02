import { PAGE_SIZE } from '@shared/constants/page-size';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, catchError, debounceTime, distinctUntilChanged, forkJoin, map, of, switchMap } from 'rxjs';
import { PageResult } from '@application/dto/base/base-response';
import { SportType } from '@application/dto/club/club.dto';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import { Tournament as TournamentModel, TournamentStatus } from '@application/dto/tournament/tournament.dto';
import { AuthService } from '@presentation/services/auth.service';
import {
  FORMAT_LABEL, SPORT_ICON, SPORT_LABEL, SPORT_OPTIONS, SPORT_SURFACE, STATUS_FILTER_OPTIONS, STATUS_META, dateTile,
  daysUntil, fillPercent, formatVnd, liveProgress, nextMilestone, seatsLabel
} from './tournament-view';

/** Nhip mua giai canh tieu de: bam de loc theo trang thai do. */
export interface TournamentPulse { live: number; open: number; upcoming: number; }

type ListTab = 'explore' | 'joined';

@Component({
  selector: 'app-tournament-list', templateUrl: './tournament-list.component.html',
  styleUrls: ['./tournament-list.component.scss'], changeDetection: ChangeDetectionStrategy.OnPush, standalone: false
})
export class TournamentListComponent {
  private readonly repository = inject(TournamentRepositoryPort);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly keyword$ = new Subject<string>();

  @ViewChild('listTop') private listTop?: ElementRef<HTMLElement>;

  readonly pageSize = PAGE_SIZE.grid;
  readonly statusMeta = STATUS_META;
  readonly sportLabel = SPORT_LABEL;
  readonly formatLabel = FORMAT_LABEL;
  readonly formatVnd = formatVnd;
  readonly fillPercent = fillPercent;
  readonly nextMilestone = nextMilestone;
  readonly sportIcon = SPORT_ICON;
  readonly sportSurface = SPORT_SURFACE;
  readonly dateTile = dateTile;
  readonly seatsLabel = seatsLabel;
  readonly liveProgress = liveProgress;
  /** Chip mon (cuon ngang) thay cho o chon mon. */
  readonly sportChips: ReadonlyArray<{ value: SportType | ''; label: string; icon: string }> = [
    { value: '', label: 'Mọi môn', icon: 'trophy' },
    ...SPORT_OPTIONS.map(option => ({ value: option.value as SportType, label: option.label, icon: SPORT_ICON[option.value as SportType] }))
  ];
  readonly statusOptions = STATUS_FILTER_OPTIONS;
  readonly signedIn = !!this.auth.currentUser;

  readonly tab = signal<ListTab>('explore');
  readonly sport = signal<SportType | ''>('');
  readonly status = signal<TournamentStatus | ''>('');
  readonly keyword = signal('');

  readonly page = signal<PageResult<TournamentModel> | null>(null);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);
  /** Doi trang: giu trang cu mo di cho den khi trang moi ve (GOAT-DESIGN §6 Pagination). */
  readonly paging = signal(false);
  readonly error = signal<string | null>(null);

  readonly featured = signal<TournamentModel | null>(null);
  readonly featuredLoading = signal(true);
  readonly featuredError = signal(false);
  readonly joinedCount = signal<number | null>(null);
  readonly pulse = signal<TournamentPulse | null>(null);

  readonly hasFilters = computed(() => !!this.sport() || !!this.status() || !!this.keyword().trim());
  /** Moi view chi mot vung navy noi bat: chi o Kham pha, trang dau, khong loc. */
  readonly showFeatured = computed(() => this.tab() === 'explore' && !this.hasFilters() && this.pageIndex() === 0);

  constructor() {
    const requested = this.route.snapshot.queryParamMap.get('tab') as ListTab | null;
    if (requested && this.signedIn && requested === 'joined') this.tab.set(requested);
    this.keyword$.pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(value => { this.keyword.set(value); this.reload(); });
    this.load();
    this.loadFeatured();
    this.loadPulse();
    if (this.signedIn) this.loadCounts();
  }

  setTab(tab: ListTab): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    void this.router.navigate([], { queryParams: { tab: tab === 'explore' ? null : tab }, replaceUrl: true });
    this.reload();
  }

  onKeyword(value: string): void { this.keyword$.next(value); }
  setSport(value: SportType | ''): void { this.sport.set(value); this.reload(); }
  setStatus(value: TournamentStatus | ''): void { this.status.set(value); this.reload(); }

  /** O nhip mua giai: bam lan nua thi bo loc. */
  togglePulseStatus(value: TournamentStatus): void {
    if (this.tab() !== 'explore') this.setTab('explore');
    this.setStatus(this.status() === value ? '' : value);
  }

  clearFilters(): void {
    this.sport.set(''); this.status.set(''); this.keyword.set(''); this.keyword$.next('');
    this.reload();
  }

  goToPage(index: number): void {
    this.pageIndex.set(index);
    this.paging.set(true);
    this.load(true);
  }

  /** Bo loc/tab doi: ve trang dau va dung skeleton (khac voi doi trang). */
  reload(): void {
    this.pageIndex.set(0);
    this.page.set(null);
    this.load();
  }

  load(keepCurrent = false): void {
    if (!keepCurrent) this.loading.set(true);
    this.error.set(null);
    this.request(this.pageIndex()).subscribe({
      next: page => {
        this.page.set(page);
        this.loading.set(false);
        if (keepCurrent) { this.paging.set(false); this.scrollListIntoView(); }
      },
      error: () => {
        this.loading.set(false);
        this.paging.set(false);
        this.error.set('Không tải được danh sách giải đấu. Kiểm tra kết nối rồi thử lại.');
      }
    });
  }

  /**
   * Mot vung navy: giai dang mo sap dong dang ky nhat; khong con giai mo thi giai dang dien ra
   * sap ket thuc nhat (LIVE). Ca hai deu khong co thi an.
   */
  loadFeatured(): void {
    this.featuredLoading.set(true);
    this.featuredError.set(false);
    this.repository.searchTournaments({ status: 'REGISTRATION_OPEN', sort: 'registrationCloseDate,asc' }, 0, 1).pipe(
      switchMap(open => open.items.length
        ? of(open)
        : this.repository.searchTournaments({ status: 'IN_PROGRESS', sort: 'endDate,asc' }, 0, 1))
    ).subscribe({
      next: page => { this.featured.set(page.items[0] ?? null); this.featuredLoading.set(false); },
      error: () => { this.featuredError.set(true); this.featuredLoading.set(false); }
    });
  }

  /** Nhan loi moi vao doi: giai do gio thuoc tab "Toi tham gia". */
  onInvitationAnswered(): void {
    this.loadCounts();
    if (this.tab() === 'joined') this.load();
  }

  /** So giai dang dien ra / mo dang ky / sap khai mac (chi doc `total`). */
  loadPulse(): void {
    const count = (status: TournamentStatus) => this.repository.searchTournaments({ status }, 0, 1).pipe(
      map(page => page.total), catchError(() => of(0)));
    forkJoin({ live: count('IN_PROGRESS'), open: count('REGISTRATION_OPEN'), upcoming: count('REGISTRATION_CLOSED') })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(pulse => this.pulse.set(pulse));
  }

  /** "Còn 2 ngày" khi giai dang mo con <= 3 ngay dang ky. */
  closingSoon(tournament: TournamentModel): number | null {
    if (tournament.status !== 'REGISTRATION_OPEN') return null;
    const days = daysUntil(tournament.registrationCloseDate);
    return days >= 0 && days <= 3 ? days : null;
  }

  /** Ngay con lai toi han dang ky (hom nay = 0, ngay mai = 1), cung cach tinh voi chip "Còn N ngày" tren the. */
  daysLeft(tournament: TournamentModel): number {
    return Math.max(0, daysUntil(tournament.registrationCloseDate));
  }

  private request(pageIndex: number): Observable<PageResult<TournamentModel>> {
    switch (this.tab()) {
      case 'joined': return this.repository.getMyTournaments('PARTICIPATING', pageIndex, this.pageSize);
      default: return this.repository.searchTournaments({
        sportType: this.sport() || undefined, status: this.status() || undefined, keyword: this.keyword()
      }, pageIndex, this.pageSize);
    }
  }

  private loadCounts(): void {
    this.repository.getMyTournaments('PARTICIPATING', 0, 1).subscribe({
      next: page => this.joinedCount.set(page.total), error: () => undefined
    });
  }

  private scrollListIntoView(): void {
    const element = this.listTop?.nativeElement;
    if (element && element.getBoundingClientRect().top < 0) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
