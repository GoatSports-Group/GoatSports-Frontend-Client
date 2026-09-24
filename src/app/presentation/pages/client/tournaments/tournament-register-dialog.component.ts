import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { FRIEND_REPOSITORY_TOKEN } from '@application/ports/persistence/friend.repository';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import { MyClubMembership } from '@domain/models/club.model';
import {
  LineupRole, SkillLevel, TeamInvitee, Tournament as TournamentModel, TournamentEligibilityRule,
  TournamentRegistration
} from '@application/dto/tournament/tournament.dto';
import { AuthService } from '@presentation/services/auth.service';
import { PlayerDirectoryService } from '@presentation/services/player-directory.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { SelectOption } from '@shared/components/ui/select/select.component';
import { SKILL_OPTIONS, formatVnd, ruleLabel } from './tournament-view';

interface InviteRow { playerId: string; lineupRole: LineupRole; shirtNumber?: number | null; }

/**
 * Dang ky giai theo noi dung thi dau: ca nhan (danh don) hoac lap doi (danh doi, mon dong doi).
 * Doi: ban la doi truong, moi ban be hoac thanh vien CLB; moi nguoi phai tu nhan loi, du so toi thieu
 * thi moi phai dong le phi. Truyen `registration` de dung lai dialog cho viec moi them nguoi.
 */
@Component({
  selector: 'app-tournament-register-dialog',
  templateUrl: './tournament-register-dialog.component.html',
  styleUrls: ['./tournament-register-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class TournamentRegisterDialogComponent implements OnInit {
  private readonly tournaments = inject(TournamentRepositoryPort);
  private readonly clubs = inject(ClubRepositoryPort);
  private readonly friends = inject(FRIEND_REPOSITORY_TOKEN);
  private readonly directory = inject(PlayerDirectoryService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotifyService);
  private readonly me = this.auth.currentUser?.userId ?? '';

  @Input({ required: true }) tournament!: TournamentModel;
  @Input() eligibilityRules: readonly TournamentEligibilityRule[] = [];
  /** Co gia tri: che do "moi them" cho doi da dang ky. */
  @Input() registration: TournamentRegistration | null = null;
  @Output() readonly registered = new EventEmitter<TournamentRegistration>();
  @Output() readonly closed = new EventEmitter<void>();

  readonly skillOptions = SKILL_OPTIONS;
  readonly roleOptions: readonly SelectOption[] = [
    { value: 'PLAYER', label: 'Thi đấu' }, { value: 'SUBSTITUTE', label: 'Dự bị' }
  ];
  readonly ruleLabel = ruleLabel;
  readonly formatVnd = formatVnd;

  readonly managedClubs = signal<MyClubMembership[]>([]);
  readonly clubId = signal<string>('');
  readonly friendOptions = signal<SelectOption[]>([]);
  readonly memberOptions = signal<SelectOption[]>([]);
  readonly candidatesLoading = signal(true);
  readonly saving = signal(false);
  readonly submitted = signal(false);

  teamName = '';
  skillLevel: SkillLevel = 'INTERMEDIATE';
  captainShirt: number | null = null;
  rows: InviteRow[] = [];

  readonly clubOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Đội tự lập (mời bạn bè)' },
    ...this.managedClubs().map(item => ({ value: item.club.clubId, label: `Đại diện ${item.club.name}` }))
  ]);
  /** Doi dai dien CLB chi moi duoc thanh vien CLB do (backend kiem y het). */
  readonly candidateOptions = computed(() => this.clubId() ? this.memberOptions() : this.friendOptions());

  get inviteMode(): boolean { return !!this.registration; }
  get isTeam(): boolean { return this.tournament.participantType === 'TEAM'; }
  get rosterMin(): number { return this.tournament.rosterMin ?? 1; }
  get rosterMax(): number { return this.tournament.rosterMax ?? 1; }

  /** Nguoi da o trong doi (da nhan loi hoac dang cho) — khong moi lai. */
  private get taken(): Set<string> {
    return new Set((this.registration?.lineups ?? []).filter(line => line.memberStatus !== 'DECLINED').map(line => line.playerId));
  }

  /** So cho con lai trong doi, tinh ca doi truong. */
  get openSeats(): number { return Math.max(0, this.rosterMax - (this.inviteMode ? this.taken.size : 1)); }

  ngOnInit(): void {
    if (!this.isTeam) { this.candidatesLoading.set(false); return; }
    if (this.inviteMode) {
      if (this.registration!.clubId) this.selectClub(this.registration!.clubId);
      else this.loadFriends();
      return;
    }
    this.loadFriends();
    // Dai dien CLB: minh la chu/quan tri CLB cung mon dang hoat dong.
    this.clubs.getMyClubs().subscribe({
      next: memberships => this.managedClubs.set(memberships.filter(item => item.status === 'ACTIVE'
        && (item.role === 'OWNER' || item.role === 'ADMIN')
        && item.club.active !== false && item.club.sportType === this.tournament.sportType)),
      error: () => undefined
    });
  }

  close(): void { if (!this.saving()) this.closed.emit(); }

  selectClub(clubId: string): void {
    this.clubId.set(clubId);
    this.rows = [];
    if (!clubId) return;
    const club = this.managedClubs().find(item => item.club.clubId === clubId)?.club;
    if (club && !this.teamName.trim()) this.teamName = club.name;
    this.candidatesLoading.set(true);
    this.clubs.getClubMembers(clubId).subscribe({
      next: members => this.toOptions([...new Set([...members.filter(item => item.status === 'ACTIVE').map(item => item.userId),
        ...(club ? [club.ownerId] : [])])], options => this.memberOptions.set(options)),
      error: () => { this.candidatesLoading.set(false); this.notify.error('Không tải được thành viên câu lạc bộ.'); }
    });
  }

  addRow(): void {
    if (this.rows.length >= this.openSeats) return;
    this.rows = [...this.rows, { playerId: '', lineupRole: 'PLAYER' }];
  }

  removeRow(index: number): void { this.rows = this.rows.filter((_, position) => position !== index); }

  /** Cung luat voi assertInviteList o backend, bao ngay tren form. */
  problem(): string | null {
    if (!this.isTeam) return null;
    if (!this.inviteMode && !this.teamName.trim() && !this.clubId()) return 'Đặt tên cho đội của bạn.';
    if (this.inviteMode && !this.rows.length) return 'Thêm ít nhất một người để mời.';
    if (this.rows.some(row => !row.playerId)) return 'Chọn người cho mọi dòng, hoặc xóa dòng trống.';
    if (this.rows.length > this.openSeats) return `Đội tối đa ${this.rosterMax} người.`;
    const players = new Set<string>([this.me, ...this.taken]);
    const shirts = new Set<number>();
    const shirtOf = (value: number | null | undefined) => value == null || `${value}` === '' ? null : Number(value);
    const captain = shirtOf(this.captainShirt);
    if (captain != null) shirts.add(captain);
    (this.registration?.lineups ?? []).forEach(line => { if (line.shirtNumber != null && line.memberStatus !== 'DECLINED') shirts.add(line.shirtNumber); });
    for (const row of this.rows) {
      if (players.has(row.playerId)) return 'Người này đã có trong đội.';
      players.add(row.playerId);
      const shirt = shirtOf(row.shirtNumber);
      if (shirt == null) continue;
      if (!Number.isInteger(shirt) || shirt < 0 || shirt > 999) return 'Số áo từ 0 đến 999.';
      if (shirts.has(shirt)) return `Số áo ${shirt} bị trùng trong đội.`;
      shirts.add(shirt);
    }
    return captain != null && (!Number.isInteger(captain) || captain < 0 || captain > 999) ? 'Số áo từ 0 đến 999.' : null;
  }

  submit(): void {
    if (this.saving()) return;
    this.submitted.set(true);
    if (this.problem()) return;
    const names = new Map(this.candidateOptions().map(option => [option.value as string, option.label]));
    const invitees: TeamInvitee[] = this.rows.map(row => ({
      playerId: row.playerId, playerName: names.get(row.playerId) ?? '', lineupRole: row.lineupRole,
      shirtNumber: row.shirtNumber == null || `${row.shirtNumber}` === '' ? undefined : Number(row.shirtNumber)
    }));
    const id = this.tournament.tournamentId;
    let request: Observable<TournamentRegistration>;
    if (this.inviteMode) request = this.tournaments.inviteMembers(id, this.registration!.registrationId, invitees);
    else if (this.isTeam) request = this.tournaments.registerTeam(id, {
      type: 'TEAM', clubId: this.clubId() || undefined, teamName: this.teamName.trim() || undefined,
      captainShirtNumber: this.captainShirt == null || `${this.captainShirt}` === '' ? undefined : Number(this.captainShirt),
      lineups: invitees
    });
    else request = this.tournaments.registerTeam(id, {
      type: 'INDIVIDUAL', playerId: this.me, teamName: this.teamName.trim() || undefined, skillLevel: this.skillLevel
    });
    this.saving.set(true);
    request.subscribe({
      next: registration => { this.saving.set(false); this.registered.emit(registration); },
      error: error => { this.saving.set(false); this.notify.error(error?.error?.message ?? 'Không thể gửi đăng ký.'); }
    });
  }

  private loadFriends(): void {
    this.candidatesLoading.set(true);
    this.friends.getFriends().subscribe({
      next: response => this.toOptions((response.data ?? [])
        .filter(item => item.status === 'ACCEPTED')
        .map(item => item.requesterId === this.me ? item.addresseeId : item.requesterId), options => this.friendOptions.set(options)),
      error: () => this.candidatesLoading.set(false)
    });
  }

  private toOptions(ids: string[], apply: (options: SelectOption[]) => void): void {
    const candidates = ids.filter(id => id && id !== this.me);
    this.directory.resolve(candidates).subscribe(users => {
      apply(candidates.map(id => ({ value: id, label: users.get(id)?.fullName || users.get(id)?.email || 'Người chơi' }))
        .sort((a, b) => a.label.localeCompare(b.label, 'vi')));
      this.candidatesLoading.set(false);
    });
  }
}
