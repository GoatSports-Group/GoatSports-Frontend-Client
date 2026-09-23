import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, filter, forkJoin, map, of, take } from 'rxjs';
import { Club, ClubMember, ClubRole, MyClubMembership, SportType } from '@application/dto/club/club.dto';
import { User } from '@application/dto/user/user.dto';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { AuthService } from '@presentation/services/auth.service';
import { NotificationService } from '@presentation/services/notification.service';
import { UserService } from '@presentation/services/user.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { CLUB_REMINDER_MOCKS, ClubReminderMock } from './club-member.mock-data';
import { DEFAULT_CLUB_BANNER, DEFAULT_CLUB_LOGO, sportLabel, winRatePercent } from './club-view.model';

interface MembershipApplication {
  member: ClubMember;
  player: User | null;
}

@Component({
  selector: 'app-club-member-workspace',
  templateUrl: './club-member-workspace.component.html',
  styleUrls: ['./club-member-pages.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class ClubMemberWorkspaceComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly repository = inject(ClubRepositoryPort);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotifyService);
  private readonly notifications = inject(NotificationService);
  private readonly users = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);

  readonly clubId = this.route.snapshot.paramMap.get('clubId') ?? '';
  readonly winRatePercent = winRatePercent;
  readonly defaultClubLogo = DEFAULT_CLUB_LOGO;
  readonly defaultClubBanner = DEFAULT_CLUB_BANNER;
  readonly club = signal<Club | null>(null);
  readonly membership = signal<MyClubMembership | null>(null);
  readonly reminders = signal<ClubReminderMock[]>([...CLUB_REMINDER_MOCKS]);
  readonly members = signal<ClubMember[]>([]);
  readonly memberProfiles = signal<Record<string, User | null>>({});
  readonly membersLoading = signal(false);
  readonly respondingIds = signal<ReadonlySet<string>>(new Set());
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly isAuthenticated = signal(false);
  readonly isManager = computed(() => this.membership()?.role === 'OWNER' || this.membership()?.role === 'ADMIN');
  readonly isOwner = computed(() => this.membership()?.role === 'OWNER');
  readonly pendingApplications = computed<MembershipApplication[]>(() => this.members()
    .filter(member => member.status === 'PENDING')
    .map(member => ({ member, player: this.memberProfiles()[member.userId] ?? null })));

  constructor() {
    this.auth.sessionReady$.pipe(filter(Boolean), take(1)).subscribe(() => {
      this.isAuthenticated.set(this.auth.isAuthenticated);
      if (this.auth.isAuthenticated && this.clubId) this.load();
      else this.loading.set(false);
    });

    this.notifications.realtimeNotifications$
      .pipe(
        filter(notification => notification.referenceType === 'CLUB_MEMBERSHIP_REQUEST'
          && notification.referenceId === this.clubId),
        takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshMembers());
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      club: this.repository.getClubDetails(this.clubId),
      memberships: this.repository.getMyClubs(),
      members: this.repository.getClubMembers(this.clubId)
    }).subscribe({
      next: ({ club, memberships, members }) => {
        this.club.set(club);
        this.membership.set(memberships.find(item => item.club.clubId === club.clubId) ?? null);
        this.setMembers(members);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Không thể tải không gian câu lạc bộ. Vui lòng thử lại.');
        this.loading.set(false);
      }
    });
  }

  login(): void { this.auth.redirectToLogin(window.location.href); }
  sportLabel(value: SportType): string { return sportLabel(value); }
  roleLabel(role: ClubRole): string { return role === 'OWNER' ? 'Chủ câu lạc bộ' : role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'; }
  openPlayerSearch(): void { void this.router.navigate(['/clubs/my', this.clubId, 'players']); }

  respondToApplication(application: MembershipApplication, accepted: boolean): void {
    if (!this.isManager() || this.respondingIds().has(application.member.membershipId)) return;
    this.respondingIds.update(ids => new Set(ids).add(application.member.membershipId));
    this.repository.respondMembership(this.clubId, application.member.membershipId, accepted).subscribe({
      next: () => {
        this.respondingIds.update(ids => {
          const next = new Set(ids);
          next.delete(application.member.membershipId);
          return next;
        });
        this.members.update(members => members.filter(member => member.membershipId !== application.member.membershipId));
        const playerName = this.playerName(application);
        this.notify.success(accepted
          ? `Đã duyệt ${playerName} vào câu lạc bộ.`
          : `Đã từ chối yêu cầu của ${playerName}.`);
      },
      error: error => {
        this.respondingIds.update(ids => {
          const next = new Set(ids);
          next.delete(application.member.membershipId);
          return next;
        });
        this.notify.error(error?.error?.message ?? 'Không thể xử lý yêu cầu tham gia.');
      }
    });
  }

  playerName(application: MembershipApplication): string {
    return application.player?.fullName || application.player?.username || 'Người chơi';
  }

  playerInitials(application: MembershipApplication): string {
    return this.playerName(application).split(/\s+/).slice(-2).map(part => part[0]).join('').toUpperCase();
  }

  requestDate(value?: string): string {
    if (!value) return 'Vừa gửi yêu cầu';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Vừa gửi yêu cầu';
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  mockAction(message: string): void {
    this.notify.info(`${message} đang dùng dữ liệu mô phỏng ở bản thiết kế frontend.`);
  }

  addMockReminder(): void {
    const reminder: ClubReminderMock = {
      id: `reminder-${Date.now()}`,
      title: 'Lời nhắc sinh hoạt mới',
      date: '05 THG 10',
      time: '18:30 – 20:00',
      location: this.club()?.location || 'Địa điểm sẽ cập nhật',
      note: 'Nội dung mẫu vừa được thêm từ giao diện quản lý.'
    };
    this.reminders.update(items => [reminder, ...items]);
    this.notify.success('Đã thêm lời nhắc mẫu vào Hoạt động sắp tới.');
  }

  useLogoFallback(event: Event): void { this.applyImageFallback(event, this.defaultClubLogo); }
  useBannerFallback(event: Event): void { this.applyImageFallback(event, this.defaultClubBanner); }

  private applyImageFallback(event: Event, fallback: string): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(fallback)) image.src = fallback;
  }

  private refreshMembers(): void {
    if (!this.clubId || !this.auth.isAuthenticated) return;
    this.membersLoading.set(true);
    this.repository.getClubMembers(this.clubId).subscribe({
      next: members => {
        this.setMembers(members);
        this.membersLoading.set(false);
      },
      error: () => this.membersLoading.set(false)
    });
  }

  private setMembers(members: ClubMember[]): void {
    this.members.set(members);
    const pendingUserIds = [...new Set(members
      .filter(member => member.status === 'PENDING')
      .map(member => member.userId))];
    if (!pendingUserIds.length) {
      this.memberProfiles.set({});
      return;
    }
    this.membersLoading.set(true);
    forkJoin(pendingUserIds.map(userId => this.users.getUserById(userId).pipe(
      map(player => ({ userId, player })),
      catchError(() => of({ userId, player: null }))
    ))).subscribe(results => {
      this.memberProfiles.set(Object.fromEntries(results.map(result => [result.userId, result.player])));
      this.membersLoading.set(false);
    });
  }
}
