import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, forkJoin, take } from 'rxjs';
import { Club, ClubRole, MyClubMembership, SportType } from '@application/dto/club/club.dto';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { AuthService } from '@presentation/services/auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { CLUB_REMINDER_MOCKS, ClubReminderMock } from './club-member.mock-data';
import { DEFAULT_CLUB_BANNER, DEFAULT_CLUB_LOGO, sportLabel } from './club-view.model';

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

  readonly clubId = this.route.snapshot.paramMap.get('clubId') ?? '';
  readonly defaultClubLogo = DEFAULT_CLUB_LOGO;
  readonly defaultClubBanner = DEFAULT_CLUB_BANNER;
  readonly club = signal<Club | null>(null);
  readonly membership = signal<MyClubMembership | null>(null);
  readonly reminders = signal<ClubReminderMock[]>([...CLUB_REMINDER_MOCKS]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly isAuthenticated = signal(false);
  readonly isManager = computed(() => this.membership()?.role === 'OWNER' || this.membership()?.role === 'ADMIN');
  readonly isOwner = computed(() => this.membership()?.role === 'OWNER');

  constructor() {
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
}
