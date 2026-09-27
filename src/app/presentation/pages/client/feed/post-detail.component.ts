import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { SocialPost } from '@application/dto/social-feed/social-feed.dto';
import { SOCIAL_FEED_REPOSITORY_TOKEN } from '@application/ports/persistence/social-feed.repository';
import { AuthService } from '@presentation/services/auth.service';
import { CommunityStore } from './community.store';
import { errorMessage } from './community-view';

/** Mot bai viet (lien ket chia se, thong bao thich / binh luan). Mo san binh luan. */
@Component({
  selector: 'app-post-detail',
  templateUrl: './post-detail.component.html',
  styleUrls: ['./post-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class PostDetailComponent implements OnInit {
  private readonly repository = inject(SOCIAL_FEED_REPOSITORY_TOKEN);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(CommunityStore);
  private readonly auth = inject(AuthService);

  readonly post = signal<SocialPost | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  private postId = '';
  private request?: Subscription;

  ngOnInit(): void {
    this.store.loadFollowing(this.auth.currentUser?.userId);
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.postId = params.get('postId') ?? '';
      this.load();
    });
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.repository.getPost(this.postId).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: post => {
        this.post.set(post);
        this.store.hydrate([post]);
      },
      error: error => this.error.set(errorMessage(error, 'Bài viết đã bị xóa, bị ẩn hoặc bạn không có quyền xem.'))
    });
  }

  /** Bai bi xoa / tac gia bi chan ngay tai trang chi tiet: quay ve bang tin. */
  leave(): void {
    void this.router.navigate(['/feed']);
  }
}
