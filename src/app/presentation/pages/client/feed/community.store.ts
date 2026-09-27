import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, tap } from 'rxjs';
import { SocialPost, UserFollowStatus } from '@application/dto/social-feed/social-feed.dto';
import { User } from '@application/dto/user/user.dto';
import { SOCIAL_FEED_REPOSITORY_TOKEN } from '@application/ports/persistence/social-feed.repository';
import { STORAGE_REPOSITORY_TOKEN } from '@application/ports/persistence/storage.repository';
import { AuthService } from '@presentation/services/auth.service';
import { PlayerDirectoryService } from '@presentation/services/player-directory.service';

/**
 * Trang thai dung chung giua bang tin, the bai viet va trang chi tiet: ten/anh tac gia,
 * URL media da ky, va danh sach dang theo doi. Mot nguoi xuat hien o nhieu bai nen nut
 * "Theo doi" o moi the phai cung doc mot nguon.
 */
@Injectable({ providedIn: 'root' })
export class CommunityStore {
  private readonly repository = inject(SOCIAL_FEED_REPOSITORY_TOKEN);
  private readonly storage = inject(STORAGE_REPOSITORY_TOKEN);
  private readonly directory = inject(PlayerDirectoryService);
  private readonly auth = inject(AuthService);

  readonly authors = signal<ReadonlyMap<string, User>>(new Map());
  readonly mediaUrls = signal<ReadonlyMap<string, string>>(new Map());
  readonly followingIds = signal<ReadonlySet<string>>(new Set());
  readonly pendingFollowIds = signal<ReadonlySet<string>>(new Set());

  /** Nap lai moi lan vao trang: tai khoan co the da doi tu lan truoc. */
  loadFollowing(currentUserId?: string | null): void {
    if (currentUserId) this.hydrateAuthors([currentUserId]);
    this.repository.getFollowingUserIds().subscribe({
      next: ids => this.followingIds.set(new Set(ids)),
      error: () => this.followingIds.set(new Set())
    });
  }

  isFollowing(userId: string): boolean {
    return this.followingIds().has(userId);
  }

  toggleFollow(userId: string): Observable<UserFollowStatus> {
    const request$ = this.isFollowing(userId)
      ? this.repository.unfollowUser(userId)
      : this.repository.followUser(userId);
    this.pendingFollowIds.update(ids => new Set(ids).add(userId));
    return request$.pipe(
      tap({
        next: status => this.followingIds.update(ids => {
          const next = new Set(ids);
          if (status.followed) next.add(userId); else next.delete(userId);
          return next;
        }),
        finalize: () => this.pendingFollowIds.update(ids => {
          const next = new Set(ids);
          next.delete(userId);
          return next;
        })
      })
    );
  }

  /** Nap tac gia va URL media cua cac bai (ca bai goc duoc chia se). */
  hydrate(posts: readonly SocialPost[]): void {
    const all = posts.flatMap(post => post.sharedPost ? [post, post.sharedPost] : [post]);
    this.hydrateAuthors(all.map(post => post.authorId));

    const missing = [...new Set(all.flatMap(post => post.attachments.map(item => item.storageKey)))]
      .filter(key => !this.mediaUrls().has(key));
    if (!missing.length) return;
    forkJoin(missing.map(key => this.storage.getFileUrl(key).pipe(
      map(url => ({ key, url })),
      catchError(() => of({ key, url: '' }))
    ))).subscribe(items => this.mediaUrls.update(current => {
      const next = new Map(current);
      items.forEach(item => next.set(item.key, item.url));
      return next;
    }));
  }

  hydrateAuthors(userIds: readonly string[]): void {
    this.directory.resolve(userIds).subscribe(resolved => this.authors.update(current => {
      const next = new Map(current);
      resolved.forEach((user, id) => next.set(id, user));
      return next;
    }));
  }

  /** Chinh minh luon co ho so tu phien dang nhap, ke ca truoc khi danh ba tra ve. */
  author(userId: string): User | null {
    const me = this.auth.currentUser;
    return this.authors().get(userId) ?? (me?.userId === userId ? me : null);
  }

  authorName(userId: string): string {
    const user = this.author(userId);
    return user?.fullName || user?.username || 'Người chơi GOAT';
  }

  avatar(userId: string): string {
    const user = this.author(userId);
    if (user?.avatarUrl) return user.avatarUrl;
    const seed = user?.fullName || user?.username || userId;
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`;
  }

  mediaUrl(storageKey: string): string {
    return this.mediaUrls().get(storageKey) ?? '';
  }
}
