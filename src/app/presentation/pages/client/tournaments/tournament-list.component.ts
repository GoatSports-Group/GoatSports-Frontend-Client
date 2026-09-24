import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { PageResult } from '@application/dto/base/base-response';
import { SportType } from '@application/dto/club/club.dto';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import { Tournament as TournamentModel, TournamentStatus } from '@application/dto/tournament/tournament.dto';
import { AuthService } from '@presentation/services/auth.service';
import { SelectOption } from '@shared/components/ui/select/select.component';
import {
  FORMAT_LABEL, SPORT_LABEL, SPORT_OPTIONS, STATUS_FILTER_OPTIONS, STATUS_META, fillPercent, formatVnd, nextMilestone
} from './tournament-view';

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

  readonly pageSize = 12;
  readonly statusMeta = STATUS_META;
  readonly sportLabel = SPORT_LABEL;
  readonly formatLabel = FORMAT_LABEL;
  readonly formatVnd = formatVnd;
  readonly fillPercent = fillPercent;
  readonly nextMilestone = nextMilestone;
  readonly sportOptions: readonly SelectOption[] = [{ value: '', label: 'Mọi môn' }, ...SPORT_OPTIONS];
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

  loadFeatured(): void {
    this.featuredLoading.set(true);
    this.featuredError.set(false);
    this.repository.searchTournaments({ status: 'REGISTRATION_OPEN', sort: 'registrationCloseDate,asc' }, 0, 1).subscribe({
      next: page => { this.featured.set(page.items[0] ?? null); this.featuredLoading.set(false); },
      error: () => { this.featuredError.set(true); this.featuredLoading.set(false); }
    });
  }

  /** Nhan loi moi vao doi: giai do gio thuoc tab "Toi tham gia". */
  onInvitationAnswered(): void {
    this.loadCounts();
    if (this.tab() === 'joined') this.load();
  }

  daysLeft(tournament: TournamentModel): number {
    const close = new Date(`${tournament.registrationCloseDate}T23:59:59`);
    return Math.max(0, Math.ceil((close.getTime() - Date.now()) / 86_400_000));
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
