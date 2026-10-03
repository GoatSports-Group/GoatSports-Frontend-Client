import {
  ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject, signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { FollowEntry } from '@application/dto/social-feed/social-feed.dto';
import { SOCIAL_FEED_REPOSITORY_TOKEN } from '@application/ports/persistence/social-feed.repository';
import { PAGE_SIZE } from '@shared/constants/page-size';
import { AuthService } from '@presentation/services/auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { CommunityStore } from './community.store';
import { errorMessage } from './community-view';

type FollowTab = 'followers' | 'following';

/** Popup hai tab "Nguoi theo doi" / "Dang theo doi" cua mot nguoi; moi tab cuon vo han, moi lan 20 nguoi. */
@Component({
  selector: 'app-follow-list-dialog',
  templateUrl: './follow-list-dialog.component.html',
  styleUrls: ['./follow-list-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class FollowListDialogComponent implements OnInit {
  private readonly repository = inject(SOCIAL_FEED_REPOSITORY_TOKEN);
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);
  readonly store = inject(CommunityStore);

  @Input({ required: true }) userId = '';
  @Input() initialTab: FollowTab = 'followers';
  @Input() followerCount: number | null = null;
  @Input() followingCount: number | null = null;
  @Output() readonly closed = new EventEmitter<void>();

  readonly tab = signal<FollowTab>('followers');
  readonly people = signal<FollowEntry[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly hasMore = signal(false);
  private page = 0;
  private request?: Subscription;

  ngOnInit(): void {
    this.store.loadFollowing(this.auth.currentUser?.userId);
    this.select(this.initialTab);
  }

  select(tab: FollowTab): void {
    this.tab.set(tab);
    this.people.set([]);
    this.page = 0;
    this.hasMore.set(false);
    this.loadMore();
  }

  loadMore(): void {
    if (this.loading()) return;
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(false);
    this.request = this.repository.getFollowList(this.userId, this.tab(), this.page + 1, PAGE_SIZE.streamLight).pipe(
      finalize(() => this.loading.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: response => {
        this.page += 1;
        const seen = new Set(this.people().map(item => item.userId));
        this.people.update(current => [...current, ...response.content.filter(item => !seen.has(item.userId))]);
        this.hasMore.set(!response.last);
        this.store.hydrateAuthors(response.content.map(item => item.userId));
      },
      error: () => this.error.set(true)
    });
  }

  /** Bam ten: dong popup va mo trang ca nhan cua nguoi do trong Cong dong. */
  openProfile(userId: string): void {
    this.closed.emit();
    void this.router.navigate(['/feed'], { queryParams: { author: userId } });
  }

  toggleFollow(userId: string): void {
    this.store.toggleFollow(userId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      error: error => this.notify.error(errorMessage(error, 'Không thể cập nhật theo dõi.'))
    });
  }
}
