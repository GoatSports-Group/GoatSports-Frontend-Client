import { ChangeDetectionStrategy, Component, DestroyRef, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, filter, forkJoin, take } from 'rxjs';
import {
  Club, ClubInvitationStatus, MyClubMembership, PlayerClubRelation, ScoutedPlayerModel, ScoutingWeekDay,
  SentInvitationModel, ShortlistEntryModel, SkillLevel, SportType
} from '@application/dto/club/club.dto';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { PLAYER_DAY_OPTIONS } from '@domain/enums/player-day-of-week.enum';
import { SKILL_LEVEL_OPTIONS } from '@domain/enums/skill-level.enum';
import { AuthService } from '@presentation/services/auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { DEFAULT_CLUB_LOGO, sportLabel } from './club-view.model';
import { initialsOf, skillLabel } from './scouting-view.model';

type ScoutingTab = 'discover' | 'shortlist' | 'invited';
type SortMode = 'fit' | 'distance' | 'elo' | 'matches';
type InvitationFilter = 'ALL' | ClubInvitationStatus;

const DEFAULT_RADIUS_KM = 25;
const PAGE_SIZE = 8;
const INVITE_MESSAGE_MAX = 500;

@Component({
  selector: 'app-club-player-search',
  templateUrl: './club-player-search.component.html',
  styleUrls: ['./club-player-search.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class ClubPlayerSearchComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly repository = inject(ClubRepositoryPort);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  readonly clubId = this.route.snapshot.paramMap.get('clubId') ?? '';
  readonly defaultClubLogo = DEFAULT_CLUB_LOGO;
  readonly pageSize = PAGE_SIZE;
  readonly inviteMessageMax = INVITE_MESSAGE_MAX;
  readonly initials = initialsOf;
  readonly skillLabel = skillLabel;

  readonly radiusOptions = [10, 25, 50, 100, 200].map(radius => ({
    value: radius, label: `Trong ${radius} km`, icon: 'navigation'
  }));
  readonly skillOptions = [
    { value: 'ALL', label: 'Mọi trình độ', icon: 'trophy' },
    ...SKILL_LEVEL_OPTIONS.map(option => ({ value: option.value, label: option.label, icon: 'trophy' }))
  ];
  readonly dayOptions = [
    { value: 'ANY', label: 'Mọi ngày', icon: 'calendar-days' },
    ...PLAYER_DAY_OPTIONS.map(option => ({ value: option.value, label: option.label, icon: 'calendar-days' }))
  ];
  readonly sortOptions = [
    { value: 'fit', label: 'Phù hợp nhất', icon: 'arrow-up-down' },
    { value: 'distance', label: 'Gần nhất', icon: 'arrow-up-down' },
    { value: 'elo', label: 'Elo cao nhất', icon: 'arrow-up-down' },
    { value: 'matches', label: 'Chơi nhiều nhất', icon: 'arrow-up-down' }
  ];
  readonly invitationFilters: ReadonlyArray<{ value: InvitationFilter; label: string }> = [
    { value: 'ALL', label: 'Tất cả' },
    { value: 'PENDING', label: 'Đang chờ' },
    { value: 'ACCEPTED', label: 'Đã nhận' },
    { value: 'DECLINED', label: 'Từ chối' },
    { value: 'CANCELLED', label: 'Đã thu hồi' }
  ];

  // ---- Page ----------------------------------------------------------------------------------
  readonly club = signal<Club | null>(null);
  readonly membership = signal<MyClubMembership | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly isAuthenticated = signal(false);
  readonly tab = signal<ScoutingTab>('discover');

  /** Backend inviteMember dung assertManager, nen quan ly CLB cung duoc tim va moi nguoi choi. */
  readonly isManager = computed(() => {
    const membership = this.membership();
    return membership?.status === 'ACTIVE' && (membership.role === 'OWNER' || membership.role === 'ADMIN');
  });

  // ---- Discover ------------------------------------------------------------------------------
  readonly candidates = signal<ReadonlyArray<ScoutedPlayerModel>>([]);
  readonly searching = signal(false);
  readonly searchError = signal<string | null>(null);
  readonly keyword = signal('');
  readonly position = signal('');
  readonly radiusKm = signal(DEFAULT_RADIUS_KM);
  readonly skill = signal<SkillLevel | 'ALL'>('ALL');
  readonly day = signal<ScoutingWeekDay | 'ANY'>('ANY');
  readonly sort = signal<SortMode>('fit');
  readonly discoverPage = signal(0);
  private readonly position$ = new Subject<string>();

  readonly hasFilters = computed(() => !!this.keyword().trim() || !!this.position().trim()
    || this.radiusKm() !== DEFAULT_RADIUS_KM || this.skill() !== 'ALL' || this.day() !== 'ANY' || this.sort() !== 'fit');

  readonly visibleCandidates = computed(() => {
    const query = this.keyword().trim().toLocaleLowerCase('vi');
    const players = query
      ? this.candidates().filter(player =>
        [player.fullName, player.username].some(value => value?.toLocaleLowerCase('vi').includes(query)))
      : [...this.candidates()];
    const by: Record<SortMode, (a: ScoutedPlayerModel, b: ScoutedPlayerModel) => number> = {
      fit: (a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0) || (a.distanceKm ?? 0) - (b.distanceKm ?? 0),
      distance: (a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0),
      elo: (a, b) => (b.eloRating ?? 0) - (a.eloRating ?? 0),
      matches: (a, b) => (b.matchCount ?? 0) - (a.matchCount ?? 0)
    };
    return players.sort(by[this.sort()]);
  });

  readonly pagedCandidates = computed(() =>
    this.visibleCandidates().slice(this.discoverPage() * PAGE_SIZE, (this.discoverPage() + 1) * PAGE_SIZE));

  // ---- Shortlist -----------------------------------------------------------------------------
  readonly shortlist = signal<ReadonlyArray<ShortlistEntryModel>>([]);
  readonly shortlistLoading = signal(true);
  readonly shortlistError = signal<string | null>(null);
  readonly shortlistPage = signal(0);
  readonly shortlistBusyIds = signal<ReadonlySet<string>>(new Set());
  readonly savingNote = signal(false);
  readonly shortlistedIds = computed(() => new Set(this.shortlist().map(entry => entry.userId)));
  readonly pagedShortlist = computed(() =>
    this.shortlist().slice(this.shortlistPage() * PAGE_SIZE, (this.shortlistPage() + 1) * PAGE_SIZE));

  // ---- Sent invitations ----------------------------------------------------------------------
  readonly invitations = signal<ReadonlyArray<SentInvitationModel>>([]);
  readonly invitationsLoading = signal(true);
  readonly invitationsError = signal<string | null>(null);
  readonly invitationFilter = signal<InvitationFilter>('ALL');
  readonly invitationPage = signal(0);
  readonly confirmCancelId = signal<string | null>(null);
  readonly cancellingId = signal<string | null>(null);
  readonly pendingInvitations = computed(() => this.invitations().filter(item => item.status === 'PENDING').length);
  readonly filteredInvitations = computed(() => {
    const status = this.invitationFilter();
    return status === 'ALL' ? this.invitations() : this.invitations().filter(item => item.status === status);
  });
  readonly pagedInvitations = computed(() =>
    this.filteredInvitations().slice(this.invitationPage() * PAGE_SIZE, (this.invitationPage() + 1) * PAGE_SIZE));

  /** Nguoi vua duoc moi trong phien nay: van hien o danh sach nhung khoa nut moi. */
  readonly invitedIds = signal<ReadonlySet<string>>(new Set());

  // ---- Selection & invite dialog ---------------------------------------------------------------
  readonly selectedId = signal<string | null>(null);
  readonly selectedPlayer = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.candidates().find(player => player.userId === id)
      ?? this.shortlist().find(entry => entry.userId === id)?.player
      ?? this.invitations().find(item => item.player?.userId === id)?.player
      ?? null;
  });
  readonly selectedEntry = computed(() => this.shortlist().find(entry => entry.userId === this.selectedId()) ?? null);
  readonly selectedRelation = computed<PlayerClubRelation>(() => {
    const id = this.selectedId();
    if (!id) return 'NONE';
    if (this.invitedIds().has(id)) return 'INVITED';
    return this.selectedEntry()?.relation
      ?? (this.invitations().some(item => item.player?.userId === id && item.status === 'PENDING') ? 'INVITED' : 'NONE');
  });

  readonly inviteTarget = signal<ScoutedPlayerModel | null>(null);
  readonly inviteMessage = signal('');
  readonly inviting = signal(false);

  constructor() {
    this.position$.pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.search());

    this.auth.sessionReady$.pipe(filter(Boolean), take(1)).subscribe(() => {
      this.isAuthenticated.set(this.auth.isAuthenticated);
      if (this.auth.isAuthenticated && this.clubId) this.load();
      else this.loading.set(false);
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      club: this.repository.getClubDetails(this.clubId),
      memberships: this.repository.getMyClubs()
    }).subscribe({
      next: ({ club, memberships }) => {
        this.club.set(club);
        this.membership.set(memberships.find(item => item.club.clubId === club.clubId) ?? null);
        this.loading.set(false);
        if (this.isManager()) {
          this.search();
          this.loadShortlist();
          this.loadInvitations();
        }
      },
      error: () => {
        this.error.set('Không thể tải thông tin câu lạc bộ để tìm người chơi.');
        this.loading.set(false);
      }
    });
  }

  // ---- Discover ------------------------------------------------------------------------------
  search(): void {
    this.searching.set(true);
    this.searchError.set(null);
    const skill = this.skill();
    const day = this.day();
    this.repository.getScoutingCandidates(this.clubId, {
      radiusKm: this.radiusKm(),
      skillLevels: skill === 'ALL' ? undefined : [skill],
      position: this.position(),
      availableOn: day === 'ANY' ? undefined : day,
      limit: 50
    }).subscribe({
      next: players => {
        this.candidates.set(players);
        this.discoverPage.set(0);
        this.searching.set(false);
        this.autoSelect(players[0]?.userId);
      },
      error: error => {
        this.searching.set(false);
        this.searchError.set(error?.error?.message ?? 'Không tìm được người chơi phù hợp.');
      }
    });
  }

  updateKeyword(value: string): void {
    this.keyword.set(value);
    this.discoverPage.set(0);
  }

  updatePosition(value: string): void {
    this.position.set(value);
    this.position$.next(value.trim());
  }

  updateRadius(value: number): void { this.radiusKm.set(Number(value)); this.search(); }
  updateSkill(value: SkillLevel | 'ALL'): void { this.skill.set(value); this.search(); }
  updateDay(value: ScoutingWeekDay | 'ANY'): void { this.day.set(value); this.search(); }
  updateSort(value: SortMode): void { this.sort.set(value); this.discoverPage.set(0); }

  clearFilters(): void {
    this.keyword.set('');
    this.position.set('');
    this.radiusKm.set(DEFAULT_RADIUS_KM);
    this.skill.set('ALL');
    this.day.set('ANY');
    this.sort.set('fit');
    this.search();
  }

  // ---- Tabs & selection ------------------------------------------------------------------------
  setTab(tab: ScoutingTab): void {
    this.tab.set(tab);
    this.confirmCancelId.set(null);
    const first = tab === 'discover' ? this.visibleCandidates()[0]?.userId
      : tab === 'shortlist' ? this.shortlist()[0]?.userId
        : this.filteredInvitations()[0]?.player?.userId;
    this.selectedId.set(null);
    this.autoSelect(first);
  }

  select(userId: string | undefined): void {
    if (userId) this.selectedId.set(userId);
  }

  closePanel(): void { this.selectedId.set(null); }

  /** Desktop: the rail always shows someone. Mobile: the panel is a sheet, so only on tap. */
  private autoSelect(userId: string | undefined): void {
    if (!userId || this.selectedId()) return;
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) this.selectedId.set(userId);
  }

  changeDiscoverPage(page: number): void { this.discoverPage.set(page); }
  changeShortlistPage(page: number): void { this.shortlistPage.set(page); }
  changeInvitationPage(page: number): void { this.invitationPage.set(page); }

  // ---- Shortlist -----------------------------------------------------------------------------
  loadShortlist(): void {
    this.shortlistLoading.set(true);
    this.shortlistError.set(null);
    this.repository.getScoutingShortlist(this.clubId).subscribe({
      next: entries => {
        this.shortlist.set(entries);
        this.shortlistLoading.set(false);
      },
      error: error => {
        this.shortlistLoading.set(false);
        this.shortlistError.set(error?.error?.message ?? 'Không tải được danh sách theo dõi.');
      }
    });
  }

  isShortlisted(userId: string): boolean { return this.shortlistedIds().has(userId); }

  toggleShortlist(player: ScoutedPlayerModel): void {
    const busy = this.shortlistBusyIds();
    if (busy.has(player.userId)) return;
    this.shortlistBusyIds.set(new Set(busy).add(player.userId));
    const done = () => this.shortlistBusyIds.update(current => {
      const next = new Set(current);
      next.delete(player.userId);
      return next;
    });

    if (this.isShortlisted(player.userId)) {
      this.repository.removeShortlistEntry(this.clubId, player.userId).subscribe({
        next: () => {
          done();
          this.shortlist.update(entries => entries.filter(entry => entry.userId !== player.userId));
          this.clampPage(this.shortlistPage, this.shortlist().length);
          this.notify.success(`Đã bỏ ${player.fullName} khỏi danh sách theo dõi.`);
        },
        error: error => {
          done();
          this.notify.error(error?.error?.message ?? 'Không bỏ theo dõi được.');
        }
      });
      return;
    }

    this.repository.saveShortlistEntry(this.clubId, player.userId).subscribe({
      next: entry => {
        done();
        this.shortlist.update(entries => [entry, ...entries.filter(item => item.userId !== entry.userId)]);
        this.notify.success(`Đã thêm ${player.fullName} vào danh sách theo dõi.`);
      },
      error: error => {
        done();
        this.notify.error(error?.error?.message ?? 'Không thêm vào danh sách theo dõi được.');
      }
    });
  }

  saveNote(note: string): void {
    const entry = this.selectedEntry();
    if (!entry || this.savingNote()) return;
    this.savingNote.set(true);
    this.repository.saveShortlistEntry(this.clubId, entry.userId, note).subscribe({
      next: saved => {
        this.savingNote.set(false);
        this.shortlist.update(entries => entries.map(item => item.userId === saved.userId ? saved : item));
        this.notify.success('Đã lưu ghi chú.');
      },
      error: error => {
        this.savingNote.set(false);
        this.notify.error(error?.error?.message ?? 'Không lưu được ghi chú.');
      }
    });
  }

  // ---- Invitations ---------------------------------------------------------------------------
  loadInvitations(): void {
    this.invitationsLoading.set(true);
    this.invitationsError.set(null);
    this.repository.getSentInvitations(this.clubId).subscribe({
      next: invitations => {
        this.invitations.set(invitations);
        this.invitationsLoading.set(false);
      },
      error: error => {
        this.invitationsLoading.set(false);
        this.invitationsError.set(error?.error?.message ?? 'Không tải được lời mời đã gửi.');
      }
    });
  }

  setInvitationFilter(value: InvitationFilter): void {
    this.invitationFilter.set(value);
    this.invitationPage.set(0);
    this.confirmCancelId.set(null);
  }

  invitationCount(value: InvitationFilter): number {
    return value === 'ALL' ? this.invitations().length : this.invitations().filter(item => item.status === value).length;
  }

  askCancel(invitationId: string): void { this.confirmCancelId.set(invitationId); }
  keepInvitation(): void { this.confirmCancelId.set(null); }

  cancelInvitation(invitation: SentInvitationModel): void {
    if (this.cancellingId()) return;
    this.cancellingId.set(invitation.invitationId);
    this.repository.cancelInvitation(this.clubId, invitation.invitationId).subscribe({
      next: () => {
        this.cancellingId.set(null);
        this.confirmCancelId.set(null);
        const userId = invitation.player?.userId;
        this.invitations.update(items => items.map(item => item.invitationId === invitation.invitationId
          ? { ...item, status: 'CANCELLED', respondedAt: new Date().toISOString() } : item));
        if (userId) {
          this.invitedIds.update(ids => { const next = new Set(ids); next.delete(userId); return next; });
          this.shortlist.update(entries => entries.map(entry =>
            entry.userId === userId && entry.relation === 'INVITED' ? { ...entry, relation: 'NONE' } : entry));
        }
        this.notify.success(`Đã thu hồi lời mời gửi ${invitation.player?.fullName ?? 'người chơi'}.`);
      },
      error: error => {
        this.cancellingId.set(null);
        this.notify.error(error?.error?.message ?? 'Không thu hồi được lời mời.');
        this.loadInvitations();
      }
    });
  }

  // ---- Invite dialog -------------------------------------------------------------------------
  canInvite(player: ScoutedPlayerModel | null | undefined, relation: PlayerClubRelation = 'NONE'): boolean {
    return !!player?.profileVisible && relation === 'NONE' && !this.invitedIds().has(player.userId);
  }

  relationOf(userId: string): PlayerClubRelation {
    if (this.invitedIds().has(userId)) return 'INVITED';
    return this.shortlist().find(entry => entry.userId === userId)?.relation ?? 'NONE';
  }

  openInvite(player: ScoutedPlayerModel): void {
    this.inviteTarget.set(player);
    this.inviteMessage.set('');
  }

  closeInvite(): void {
    if (!this.inviting()) this.inviteTarget.set(null);
  }

  sendInvite(): void {
    const player = this.inviteTarget();
    if (!player || this.inviting()) return;
    this.inviting.set(true);
    const message = this.inviteMessage().trim() || undefined;
    this.repository.inviteMember(this.clubId, player.userId, message).subscribe({
      next: () => {
        this.inviting.set(false);
        this.inviteTarget.set(null);
        this.invitedIds.update(ids => new Set(ids).add(player.userId));
        this.shortlist.update(entries => entries.map(entry =>
          entry.userId === player.userId ? { ...entry, relation: 'INVITED' } : entry));
        this.loadInvitations();
        this.notify.success(`Đã gửi lời mời đến ${player.fullName}.`);
      },
      error: error => {
        this.inviting.set(false);
        this.notify.error(error?.error?.message ?? `Không thể gửi lời mời đến ${player.fullName}.`);
      }
    });
  }

  // ---- View helpers --------------------------------------------------------------------------
  relationLabel(relation: PlayerClubRelation): string {
    switch (relation) {
      case 'INVITED': return 'Đã mời';
      case 'REQUESTED': return 'Đang xin vào';
      case 'MEMBER': return 'Đã là thành viên';
      case 'BANNED': return 'Đang bị cấm';
      default: return '';
    }
  }

  invitationStatusLabel(status: ClubInvitationStatus): string {
    switch (status) {
      case 'PENDING': return 'Đang chờ';
      case 'ACCEPTED': return 'Đã nhận';
      case 'DECLINED': return 'Từ chối';
      default: return 'Đã thu hồi';
    }
  }

  formatDate(value?: string): string {
    if (!value) return '';
    const date = new Date(value.replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatDistance(value?: number): string {
    return value == null ? '—' : `${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`;
  }

  login(): void { this.auth.redirectToLogin(window.location.href); }
  sportLabel(value: SportType): string { return sportLabel(value); }

  useLogoFallback(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(this.defaultClubLogo)) image.src = this.defaultClubLogo;
  }

  private clampPage(page: WritableSignal<number>, total: number): void {
    const last = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
    if (page() > last) page.set(last);
  }
}
