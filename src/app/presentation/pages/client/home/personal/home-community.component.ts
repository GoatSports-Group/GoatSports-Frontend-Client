import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { PostDialogService } from '@presentation/pages/client/feed/post-dialog.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { SocialPost } from '@application/dto/social-feed/social-feed.dto';
import { User } from '@application/dto/user/user.dto';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { SOCIAL_FEED_REPOSITORY_TOKEN } from '@application/ports/persistence/social-feed.repository';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import { ClubActivity as ClubActivityModel, MyClubMembership } from '@application/dto/club/club.dto';
import { Tournament as TournamentModel } from '@application/dto/tournament/tournament.dto';
import { PlayerDirectoryService } from '@presentation/services/player-directory.service';
import { dayLabel, hhmm, localDateTime, sportLabel, valid } from './home-personal.utils';

type Section<T> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; items: T[] };

interface ClubRow {
  membership: MyClubMembership;
  next?: ClubActivityModel;
}

interface FriendPost {
  post: SocialPost;
  author?: User;
}

const ROLE_LABEL: Record<string, string> = { OWNER: 'Chủ CLB', ADMIN: 'Quản lý', MEMBER: 'Thành viên' };

/** Ưu tiên 3 · Cộng đồng của tôi: CLB, giải đấu đang mở đăng ký và hoạt động của người mình theo dõi. */
@Component({
  selector: 'app-home-community',
  templateUrl: './home-community.component.html',
  styleUrls: ['./home-community.component.scss'],
  standalone: false
})
export class HomeCommunityComponent implements OnInit {
  private readonly clubRepo = inject(ClubRepositoryPort);
  private readonly tournamentRepo = inject(TournamentRepositoryPort);
  private readonly socialFeed = inject(SOCIAL_FEED_REPOSITORY_TOKEN);
  private readonly directory = inject(PlayerDirectoryService);
  readonly postDialog = inject(PostDialogService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sportLabel = sportLabel;
  readonly roleLabel = ROLE_LABEL;
  readonly clubs = signal<Section<ClubRow>>({ state: 'loading' });
  readonly tournaments = signal<Section<TournamentModel>>({ state: 'loading' });
  readonly friends = signal<Section<FriendPost>>({ state: 'loading' });
  private readonly now = new Date();

  readonly clubItems = computed(() => this.items(this.clubs()));
  readonly tournamentItems = computed(() => this.items(this.tournaments()));
  readonly friendItems = computed(() => this.items(this.friends()));

  ngOnInit(): void {
    this.loadClubs();
    this.loadTournaments();
    this.loadFriends();
  }

  loadClubs(): void {
    this.clubs.set({ state: 'loading' });
    forkJoin({
      memberships: this.clubRepo.getMyClubs(),
      activities: this.clubRepo.getMyUpcomingActivities(12).pipe(catchError(() => of([] as ClubActivityModel[])))
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ memberships, activities }) => {
        const items = memberships
          .filter(item => item.status === 'ACTIVE' && !item.club.disbandedAt)
          .map(membership => ({
            membership,
            next: activities.find(activity => activity.clubId === membership.club.clubId)
          }))
          .sort((left, right) => Number(!!right.next) - Number(!!left.next));
        this.clubs.set({ state: 'ready', items });
      },
      error: () => this.clubs.set({ state: 'error' })
    });
  }

  loadTournaments(): void {
    this.tournaments.set({ state: 'loading' });
    this.tournamentRepo.searchTournaments({ status: 'REGISTRATION_OPEN', sort: 'registrationCloseDate,asc' }, 0, 8)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => this.tournaments.set({ state: 'ready', items: page.items }),
        error: () => this.tournaments.set({ state: 'error' })
      });
  }

  loadFriends(): void {
    this.friends.set({ state: 'loading' });
    this.socialFeed.getFeed(0, 8, { followingOnly: true, withFriends: true }).pipe(
      map(page => page.content),
      switchMap(posts => posts.length
        ? this.directory.resolve(posts.map(post => post.authorId)).pipe(
          map(users => posts.map(post => ({ post, author: users.get(post.authorId) }))))
        : of([] as FriendPost[])),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: items => this.friends.set({ state: 'ready', items }),
      error: () => this.friends.set({ state: 'error' })
    });
  }

  activityLabel(activity: ClubActivityModel): string {
    const start = new Date(activity.startAt);
    return `${activity.title} · ${dayLabel(start, this.now)} ${hhmm(start)}`;
  }

  /** Hạn đăng ký tính theo ngày lịch: hôm nay, ngày mai, rồi "còn N ngày". */
  closeLabel(tournament: TournamentModel): string {
    const days = this.daysUntil(tournament.registrationCloseDate);
    if (Number.isNaN(days)) return 'Đang mở';
    if (days <= 0) return 'Hết hạn hôm nay';
    return days === 1 ? 'Hết hạn ngày mai' : `Còn ${days} ngày`;
  }

  closeSoon(tournament: TournamentModel): boolean {
    return this.daysUntil(tournament.registrationCloseDate) <= 2;
  }

  fee(tournament: TournamentModel): string {
    return tournament.entryFee
      ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(tournament.entryFee)
      : 'Miễn phí';
  }

  filled(tournament: TournamentModel): number {
    return Math.min(100, Math.round(100 * tournament.currentParticipants / Math.max(1, tournament.maxParticipants)));
  }

  startLabel(tournament: TournamentModel): string {
    const start = localDateTime(tournament.startDate);
    return valid(start) ? `Khởi tranh ${dayLabel(start, this.now).toLowerCase()}` : 'Chưa chốt ngày khởi tranh';
  }

  authorName(item: FriendPost): string {
    return item.author?.fullName || item.author?.username || 'Người chơi';
  }

  /** Người: hai chữ cuối (Hoàng Nam → HN); CLB: hai chữ đầu (GOAT Badminton → GB). */
  initials(name: string, club = false): string {
    const words = name.split(/\s+/).filter(Boolean);
    return (club ? words.slice(0, 2) : words.slice(-2)).map(part => part[0]).join('').toUpperCase();
  }

  timeAgo(value: string): string {
    const minutes = Math.max(1, Math.round((this.now.getTime() - new Date(value).getTime()) / 60_000));
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    return `${Math.round(hours / 24)} ngày trước`;
  }

  private daysUntil(date: string): number {
    const today = new Date(this.now.getFullYear(), this.now.getMonth(), this.now.getDate());
    return Math.round((localDateTime(date).getTime() - today.getTime()) / 86_400_000);
  }

  private items<T>(section: Section<T>): T[] {
    return section.state === 'ready' ? section.items : [];
  }
}
