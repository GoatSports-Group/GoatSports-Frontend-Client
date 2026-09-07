import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { User } from '@application/dto/user/user.dto';
import { Club as ClubModel, ClubActivity as ClubActivityModel, ClubMember as ClubMemberModel,
  CreateClubActivityPayload } from '@application/dto/club/club.dto';
import { AuthService } from '@presentation/services/auth.service';
import { PlayerDirectoryService } from '@presentation/services/player-directory.service';
import { NotifyService } from '@shared/components/notify/notify.service';

type ClubTab = 'OVERVIEW' | 'ACTIVITIES' | 'MEMBERS';

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
  private readonly notify = inject(NotifyService);
  readonly clubId = this.route.snapshot.paramMap.get('id') ?? '';

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
  readonly isOwner = computed(() => this.club()?.ownerId === this.auth.currentUser?.userId);
  readonly isManager = computed(() => this.isOwner() || (this.membership()?.status === 'ACTIVE' && this.membership()?.role === 'ADMIN'));
  readonly isActiveMember = computed(() => this.membership()?.status === 'ACTIVE');
  activityForm: CreateClubActivityPayload = { title: '', description: '', startAt: '', endAt: '' };

  constructor() { if (this.clubId) this.load(); else this.error.set('Mã câu lạc bộ không hợp lệ.'); }

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
        this.membership.set(data.membership); this.loading.set(false); this.resolveUsers(data.club, data.members);
      },
      error: () => { this.error.set('Không thể tải thông tin câu lạc bộ.'); this.loading.set(false); }
    });
  }
  setTab(tab: ClubTab): void { this.activeTab.set(tab); }
  join(): void {
    if (!this.auth.currentUser) { this.auth.redirectToLogin(); return; }
    this.mutating.set(true);
    this.repository.joinClub(this.clubId).subscribe({
      next: membership => { this.membership.set(membership); this.mutating.set(false);
        this.notify.success(membership.status === 'ACTIVE' ? 'Đã tham gia câu lạc bộ.' : 'Yêu cầu đang chờ duyệt.'); this.load(); },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể tham gia câu lạc bộ.'); }
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
    this.mutating.set(true);
    this.repository.createClubActivity(this.clubId, { ...this.activityForm, title: this.activityForm.title.trim() }).subscribe({
      next: activity => { this.activities.update(items => [activity, ...items]); this.showActivityModal.set(false);
        this.mutating.set(false); this.activityForm = { title: '', description: '', startAt: '', endAt: '' };
        this.notify.success('Đã tạo hoạt động.'); },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể tạo hoạt động.'); }
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
