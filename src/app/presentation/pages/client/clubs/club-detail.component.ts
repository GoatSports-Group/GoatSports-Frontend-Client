import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { User } from '@application/dto/user/user.dto';
import { Club as ClubModel, ClubActivity as ClubActivityModel, ClubFee as ClubFeeModel,
  ClubFeePayment as ClubFeePaymentModel, ClubMember as ClubMemberModel,
  CreateClubActivityPayload, CreateClubFeePayload, ClubRole,
  UpdateClubPayload, ClubPrivacy, ClubApprovalMode } from '@application/dto/club/club.dto';
import { AuthService } from '@presentation/services/auth.service';
import { PlayerDirectoryService } from '@presentation/services/player-directory.service';
import { SearchPlayersUseCase } from '@application/usecase/user/search-players.usecase';
import { PlayerSummary } from '@application/dto/user/user.dto';
import { NotifyService } from '@shared/components/notify/notify.service';
import { ClubCardView, DEFAULT_CLUB_BANNER, DEFAULT_CLUB_LOGO, sportLabel, toCardView } from './club-view.model';

type ClubTab = 'OVERVIEW' | 'MEMBERS' | 'REQUESTS' | 'ACTIVITIES' | 'TOURNAMENTS' | 'GALLERY' | 'DISCUSSION' | 'FEES' | 'SETTINGS';
type ClubViewerState = 'MANAGER' | 'MEMBER' | 'PENDING' | 'GUEST';
type ClubMatchResult = 'WIN' | 'DRAW' | 'LOSS';

interface ClubRecentMatch {
  matchId: string;
  opponentName: string;
  playedAt: string;
  clubScore: number;
  opponentScore: number;
  result: ClubMatchResult;
}

@Component({
  selector: 'app-club-detail', templateUrl: './club-detail.component.html',
  styleUrls: ['./club-detail.component.scss'], changeDetection: ChangeDetectionStrategy.OnPush, standalone: false
})
export class ClubDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly repository = inject(ClubRepositoryPort);
  private readonly auth = inject(AuthService);
  private readonly directory = inject(PlayerDirectoryService);
  private readonly searchPlayers = inject(SearchPlayersUseCase);
  private readonly notify = inject(NotifyService);
  readonly clubId = this.route.snapshot.paramMap.get('clubId') ?? '';

  readonly club = signal<ClubModel | null>(null);
  readonly members = signal<ClubMemberModel[]>([]);
  readonly activities = signal<ClubActivityModel[]>([]);
  readonly membership = signal<ClubMemberModel | null>(null);
  readonly users = signal<ReadonlyMap<string, User>>(new Map());
  readonly activeTab = signal<ClubTab>('OVERVIEW');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly mutating = signal(false);
  readonly showActivityModal = signal(false);
  readonly showFeeModal = signal(false);
  readonly showInviteModal = signal(false);
  readonly showJoinRequestModal = signal(false);
  readonly inviteResults = signal<PlayerSummary[]>([]);
  readonly inviteSearching = signal(false);
  readonly showClubModal = signal(false);
  readonly fees = signal<ClubFeeModel[]>([]);
  readonly feePayments = signal<ReadonlyMap<string, ClubFeePaymentModel[]>>(new Map());
  readonly expandedFeeId = signal<string | null>(null);
  readonly editingActivityId = signal<string | null>(null);
  readonly defaultClubLogo = DEFAULT_CLUB_LOGO;
  readonly defaultClubBanner = DEFAULT_CLUB_BANNER;
  readonly isOwner = computed(() => this.club()?.ownerId === this.auth.currentUser?.userId);
  readonly isManager = computed(() => this.isOwner() || (this.membership()?.status === 'ACTIVE' && this.membership()?.role === 'ADMIN'));
  readonly isActiveMember = computed(() => this.isOwner() || this.membership()?.status === 'ACTIVE');
  readonly viewerState = computed<ClubViewerState>(() => {
    if (this.isManager()) return 'MANAGER';
    if (this.isActiveMember()) return 'MEMBER';
    if (this.membership()?.status === 'PENDING') return 'PENDING';
    return 'GUEST';
  });
  readonly activeMembers = computed(() => this.members().filter(member => member.status === 'ACTIVE'));
  readonly pendingMembers = computed(() => this.members().filter(member => member.status === 'PENDING'));
  readonly sortedActivities = computed(() => [...this.activities()]
    .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime()));
  /** Ready for the tournament/match API; empty until the backend exposes fixture history. */
  readonly recentMatches = signal<ReadonlyArray<ClubRecentMatch>>([]);
  readonly joinRequestClub = computed<ClubCardView | null>(() => {
    const current = this.club();
    return current ? toCardView(current) : null;
  });
  activityForm: CreateClubActivityPayload = { title: '', description: '', startAt: '', endAt: '' };
  feeForm: CreateClubFeePayload = { name: '', amount: 0, dueDate: '', required: true };
  inviteQuery = '';
  inviteMessage = '';
  clubForm: UpdateClubPayload = { name: '', description: '', tags: [], privacy: 'PUBLIC', approvalMode: 'AUTO' };

  constructor() {
    if (this.clubId) {
      this.load();
      return;
    }

    this.error.set('Mã câu lạc bộ không hợp lệ.');
    this.loading.set(false);
  }

  load(): void {
    this.loading.set(true); this.error.set(null);
    const membershipRequest = this.auth.currentUser
      ? this.repository.getMyMembership(this.clubId).pipe(catchError(() => of(null))) : of(null);
    forkJoin({
      club: this.repository.getClubDetails(this.clubId),
      members: this.repository.getClubMembers(this.clubId),
      activities: this.repository.getClubActivities(this.clubId),
      membership: membershipRequest
    }).subscribe({
      next: data => {
        this.club.set(data.club); this.members.set(data.members); this.activities.set(data.activities);
        this.membership.set(data.membership);
        if (this.route.snapshot.fragment === 'membership-requests' && this.isManager()) {
          this.activeTab.set('REQUESTS');
        }
        this.loading.set(false); this.resolveUsers(data.club, data.members);
      },
      error: () => { this.error.set('Không thể tải thông tin câu lạc bộ.'); this.loading.set(false); }
    });
  }
  setTab(tab: ClubTab): void {
    this.activeTab.set(tab);
    if (tab === 'FEES' && !this.fees().length) this.loadFees();
  }

  sportName(): string { return this.club() ? sportLabel(this.club()!.sportType) : ''; }

  locationLabel(): string {
    const current = this.club();
    return current?.location || current?.city || 'Chưa cập nhật địa điểm sinh hoạt';
  }

  roleLabel(): string {
    if (this.isOwner()) return 'Chủ CLB';
    if (this.isManager()) return 'Quản lý CLB';
    if (this.viewerState() === 'MEMBER') return 'Thành viên';
    if (this.viewerState() === 'PENDING') return 'Đang chờ duyệt';
    return 'Chưa tham gia';
  }

  hasAuthenticatedUser(): boolean { return Boolean(this.auth.currentUser); }

  openPlayerSearch(): void { void this.router.navigate(['/clubs/my', this.clubId, 'players']); }

  goToMyClubs(): void { void this.router.navigate(['/clubs/my']); }

  promote(member: ClubMemberModel): void {
    const next: ClubRole = member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN';
    if (this.mutating()) return;
    this.mutating.set(true);
    this.repository.changeMemberRole(this.clubId, member.membershipId, next).subscribe({
      next: () => {
        this.mutating.set(false);
        this.notify.success(next === 'ADMIN' ? 'Đã phong quản trị viên.' : 'Đã gỡ quyền quản trị.');
        this.load();
      },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể đổi vai trò.'); }
    });
  }

  removeMember(member: ClubMemberModel, ban: boolean): void {
    if (this.mutating()) return;
    const question = ban
      ? 'Cấm thành viên này khỏi câu lạc bộ? Họ sẽ không tham gia lại được.'
      : 'Xóa thành viên này khỏi câu lạc bộ?';
    if (!window.confirm(question)) return;
    this.mutating.set(true);
    this.repository.removeMember(this.clubId, member.membershipId, ban).subscribe({
      next: () => {
        this.mutating.set(false);
        this.notify.success(ban ? 'Đã cấm thành viên.' : 'Đã xóa thành viên.');
        this.load();
      },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể xử lý thành viên.'); }
    });
  }

  editActivity(activity: ClubActivityModel): void {
    this.editingActivityId.set(activity.activityId);
    this.activityForm = {
      title: activity.title,
      description: activity.description ?? '',
      startAt: activity.startAt?.slice(0, 16) ?? '',
      endAt: activity.endAt?.slice(0, 16) ?? ''
    };
    this.showActivityModal.set(true);
  }

  deleteActivity(activity: ClubActivityModel): void {
    if (this.mutating() || !window.confirm('Xóa hoạt động này?')) return;
    this.mutating.set(true);
    this.repository.deleteClubActivity(this.clubId, activity.activityId).subscribe({
      next: () => {
        this.activities.update(items => items.filter(item => item.activityId !== activity.activityId));
        this.mutating.set(false);
        this.notify.success('Đã xóa hoạt động.');
      },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể xóa hoạt động.'); }
    });
  }

  closeActivityModal(): void {
    this.showActivityModal.set(false);
    this.editingActivityId.set(null);
    this.activityForm = { title: '', description: '', startAt: '', endAt: '' };
  }

  loadFees(): void {
    if (!this.auth.currentUser) return;
    this.repository.getClubFees(this.clubId).pipe(catchError(() => of([] as ClubFeeModel[])))
      .subscribe(fees => this.fees.set(fees));
  }

  toggleFeePayments(fee: ClubFeeModel): void {
    if (this.expandedFeeId() === fee.feeId) { this.expandedFeeId.set(null); return; }
    this.expandedFeeId.set(fee.feeId);
    if (this.feePayments().has(fee.feeId)) return;
    this.repository.getFeePayments(this.clubId, fee.feeId).subscribe({
      next: payments => this.feePayments.update(current => new Map(current).set(fee.feeId, payments)),
      error: error => this.notify.error(error?.error?.message ?? 'Không thể tải lịch sử đóng phí.')
    });
  }

  createFee(): void {
    if (this.mutating() || !this.feeForm.name.trim() || !this.feeForm.dueDate) return;
    this.mutating.set(true);
    this.repository.createClubFee(this.clubId, { ...this.feeForm, name: this.feeForm.name.trim() }).subscribe({
      next: fee => {
        this.fees.update(items => [...items, fee]);
        this.showFeeModal.set(false);
        this.mutating.set(false);
        this.feeForm = { name: '', amount: 0, dueDate: '', required: true };
        this.notify.success('Đã tạo khoản phí.');
      },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể tạo khoản phí.'); }
    });
  }

  payFee(fee: ClubFeeModel): void {
    if (this.mutating()) return;
    this.mutating.set(true);
    this.repository.initiateFeePayment(this.clubId, fee.feeId).subscribe({
      next: () => {
        this.mutating.set(false);
        this.notify.success('Đã ghi nhận yêu cầu đóng phí, vui lòng hoàn tất thanh toán.');
        this.loadFees();
      },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể khởi tạo đóng phí.'); }
    });
  }

  waiveFee(fee: ClubFeeModel, membershipId: string): void {
    if (this.mutating()) return;
    this.mutating.set(true);
    this.repository.waiveFee(this.clubId, fee.feeId, membershipId).subscribe({
      next: () => {
        this.mutating.set(false);
        this.feePayments.update(current => {
          const next = new Map(current);
          next.delete(fee.feeId);
          return next;
        });
        this.expandedFeeId.set(null);
        this.notify.success('Đã miễn khoản phí cho thành viên.');
        this.loadFees();
      },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể miễn khoản phí.'); }
    });
  }

  paymentsOf(feeId: string): ClubFeePaymentModel[] { return this.feePayments().get(feeId) ?? []; }

  unpaidMembers(feeId: string): ClubMemberModel[] {
    const settled = new Set(this.paymentsOf(feeId)
      .filter(item => item.status === 'SUCCEEDED' || item.status === 'WAIVED')
      .map(item => item.membershipId));
    return this.members().filter(item => item.status === 'ACTIVE' && !settled.has(item.membershipId));
  }

  feeStatusLabel(status: string | null): string {
    switch (status) {
      case 'SUCCEEDED': return 'Đã đóng';
      case 'WAIVED': return 'Được miễn';
      case 'PENDING': return 'Chờ thanh toán';
      case 'FAILED': return 'Thanh toán lỗi';
      default: return 'Chưa đóng';
    }
  }
  startJoin(): void {
    if (!this.auth.currentUser) {
      this.auth.notifyAuthenticationRequired('Vui lòng đăng nhập để tham gia câu lạc bộ.');
      return;
    }
    if (this.club()?.approvalMode === 'MANUAL') {
      this.showJoinRequestModal.set(true);
      return;
    }
    this.join();
  }

  join(message?: string): void {
    if (this.mutating()) return;
    this.mutating.set(true);
    this.repository.joinClub(this.clubId, message).subscribe({
      next: membership => {
        this.membership.set(membership);
        this.showJoinRequestModal.set(false);
        this.mutating.set(false);
        this.notify.success(membership.status === 'ACTIVE' ? 'Đã tham gia câu lạc bộ.' : 'Yêu cầu đang chờ duyệt.');
        this.load();
      },
      error: error => {
        this.mutating.set(false);
        this.notify.error(error?.error?.message ?? 'Không thể tham gia câu lạc bộ.');
      }
    });
  }
  leave(): void {
    if (this.mutating()) return; this.mutating.set(true);
    this.repository.leaveClub(this.clubId).subscribe({
      next: () => { this.mutating.set(false); this.membership.set(null); this.notify.success('Đã rời câu lạc bộ.'); this.load(); },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể rời câu lạc bộ.'); }
    });
  }
  respond(member: ClubMemberModel, accepted: boolean): void {
    this.repository.respondMembership(this.clubId, member.membershipId, accepted).subscribe({
      next: () => { this.notify.success(accepted ? 'Đã duyệt thành viên.' : 'Đã từ chối yêu cầu.'); this.load(); },
      error: error => this.notify.error(error?.error?.message ?? 'Không thể xử lý yêu cầu.')
    });
  }
  createActivity(): void {
    if (!this.activityForm.title.trim() || !this.activityForm.startAt || !this.activityForm.endAt) return;
    if (this.activityForm.endAt <= this.activityForm.startAt) {
      this.notify.warning('Thời điểm kết thúc phải sau thời điểm bắt đầu.');
      return;
    }
    this.mutating.set(true);
    const payload = { ...this.activityForm, title: this.activityForm.title.trim() };
    const editingId = this.editingActivityId();
    const request = editingId
      ? this.repository.updateClubActivity(this.clubId, editingId, payload)
      : this.repository.createClubActivity(this.clubId, payload);
    request.subscribe({
      next: activity => {
        this.activities.update(items => editingId
          ? items.map(item => item.activityId === editingId ? activity : item)
          : [activity, ...items]);
        this.mutating.set(false);
        this.closeActivityModal();
        this.notify.success(editingId ? 'Đã cập nhật hoạt động.' : 'Đã tạo hoạt động.');
      },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể lưu hoạt động.'); }
    });
  }
  openClubModal(): void {
    const current = this.club();
    if (!current) return;
    this.clubForm = {
      name: current.name,
      description: current.description ?? '',
      logoUrl: current.logoUrl ?? '',
      tags: [...(current.tags ?? [])],
      privacy: current.privacy,
      approvalMode: current.approvalMode
    };
    this.showClubModal.set(true);
  }

  saveClub(): void {
    if (this.mutating() || !this.clubForm.name?.trim()) return;
    this.mutating.set(true);
    this.repository.updateClub(this.clubId, { ...this.clubForm, name: this.clubForm.name.trim() }).subscribe({
      next: club => {
        this.club.set(club);
        this.mutating.set(false);
        this.showClubModal.set(false);
        this.notify.success('Da cap nhat cau lac bo.');
      },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Khong the cap nhat cau lac bo.'); }
    });
  }

  setPrivacy(value: string): void { this.clubForm.privacy = value as ClubPrivacy; }
  setApprovalMode(value: string): void { this.clubForm.approvalMode = value as ClubApprovalMode; }

  openInviteModal(): void {
    this.inviteQuery = '';
    this.inviteMessage = '';
    this.inviteResults.set([]);
    this.showInviteModal.set(true);
  }

  /** Tìm người chơi theo tên hoặc email; chỉ ban quản trị mới thấy nút mở ô này. */
  runInviteSearch(): void {
    const query = this.inviteQuery.trim();
    if (query.length < 2) {
      this.inviteResults.set([]);
      return;
    }
    this.inviteSearching.set(true);
    this.searchPlayers.execute(query).subscribe({
      next: players => { this.inviteResults.set(players); this.inviteSearching.set(false); },
      error: () => { this.inviteResults.set([]); this.inviteSearching.set(false); }
    });
  }

  invite(player: PlayerSummary): void {
    if (this.mutating()) return;
    this.mutating.set(true);
    this.repository.inviteMember(this.clubId, player.userId, this.inviteMessage.trim() || undefined).subscribe({
      next: () => {
        this.mutating.set(false);
        this.showInviteModal.set(false);
        this.notify.success(`Đã gửi lời mời tới ${player.fullName || player.username}.`);
      },
      error: error => {
        this.mutating.set(false);
        this.notify.error(error?.error?.message ?? 'Không gửi được lời mời.');
      }
    });
  }

  openChat(): void { const id = this.club()?.conversationId; if (id) void this.router.navigate(['/chat', id]); }
  displayName(userId: string): string { return this.users().get(userId)?.fullName || this.users().get(userId)?.email || `Người dùng ${userId.slice(0, 8)}`; }
  avatar(userId: string): string | undefined { return this.users().get(userId)?.avatarUrl; }
  initials(value: string): string { return value.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
  private resolveUsers(club: ClubModel, members: ClubMemberModel[]): void {
    this.directory.resolve([club.ownerId, ...members.map(member => member.userId)]).subscribe(users => this.users.set(users));
  }
}
