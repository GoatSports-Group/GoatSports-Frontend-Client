import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { SocialPost } from '@application/dto/social-feed/social-feed.dto';
import { SOCIAL_FEED_REPOSITORY_TOKEN } from '@application/ports/persistence/social-feed.repository';
import { AuthService } from '@presentation/services/auth.service';
import { CommunityStore } from './community.store';
import { errorMessage } from './community-view';
import { PostDialogService } from './post-dialog.service';

/**
 * Popup bai viet (host o layout client): bai day du, binh luan mo san va cuon vo han ben trong popup.
 * Mo tu bang tin, cot ben, thong bao, Trang chu... va tu link /feed?post=:id (link cu /feed/posts/:id chuyen ve day).
 */
@Component({
  selector: 'app-post-dialog',
  templateUrl: './post-dialog.component.html',
  styleUrls: ['./post-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class PostDialogComponent {
  private readonly repository = inject(SOCIAL_FEED_REPOSITORY_TOKEN);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  readonly dialog = inject(PostDialogService);
  readonly store = inject(CommunityStore);

  readonly post = signal<SocialPost | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  private request?: Subscription;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
    effect(() => {
      const target = this.dialog.current();
      this.request?.unsubscribe();
      this.error.set(null);
      if (!target) {
        this.post.set(null);
        return;
      }
      this.store.loadFollowing(this.auth.currentUser?.userId);
      if (target.post) {
        this.post.set(target.post);
        this.store.hydrate([target.post]);
        return;
      }
      this.post.set(null);
      this.load(target.postId);
    });
  }

  load(postId: string): void {
    this.loading.set(true);
    this.request = this.repository.getPost(postId).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: post => {
        this.post.set(post);
        this.store.hydrate([post]);
      },
      error: error => this.error.set(errorMessage(error, 'Bài viết đã bị xóa, bị ẩn hoặc bạn không có quyền xem.'))
    });
  }

  close(): void {
    this.dialog.close();
    // Mo tu link /feed?post=:id: dong popup thi bo tham so de "Quay lai" khong mo lai.
    if (this.router.routerState.snapshot.root.queryParamMap.has('post')) {
      void this.router.navigate([], { relativeTo: this.route, queryParams: { post: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  onChanged(post: SocialPost): void {
    this.post.set(post);
    this.dialog.changes.next(post);
  }

  onRemoved(postId: string): void {
    this.dialog.removals.next(postId);
    this.close();
  }
}
