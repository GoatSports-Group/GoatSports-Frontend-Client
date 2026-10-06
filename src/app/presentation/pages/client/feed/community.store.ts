import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, forkJoin, map, of } from 'rxjs';
import { Friendship, UserBlock } from '@application/dto/friend/friend.dto';
import { FRIEND_REPOSITORY_TOKEN } from '@application/ports/persistence/friend.repository';
import { SocialPost } from '@application/dto/social-feed/social-feed.dto';
import { User } from '@application/dto/user/user.dto';
import { SOCIAL_FEED_REPOSITORY_TOKEN } from '@application/ports/persistence/social-feed.repository';
import { STORAGE_REPOSITORY_TOKEN } from '@application/ports/persistence/storage.repository';
import { AuthService } from '@presentation/services/auth.service';
import { PlayerDirectoryService } from '@presentation/services/player-directory.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { errorMessage } from './community-view';

export interface Connections {
  friends: Friendship[];
  received: Friendship[];
  sent: Friendship[];
  blocked: UserBlock[];
}

const NO_CONNECTIONS: Connections = { friends: [], received: [], sent: [], blocked: [] };

/** Quan he cua nguoi dang nhap voi mot nguoi khac (nut "Ket ban" o moi noi trong Cong dong doc chung). */
export type Relation = 'SELF' | 'FRIEND' | 'SENT' | 'RECEIVED' | 'BLOCKED' | 'NONE';

/**
 * Trang thai dung chung giua bang tin, the bai viet va trang chi tiet: ten/anh tac gia,
 * URL media da ky, va ban be / loi moi. Mot nguoi xuat hien o nhieu bai nen nut
 * "Ket ban" o moi the phai cung doc mot nguon.
 */
@Injectable({ providedIn: 'root' })
export class CommunityStore {
  private readonly repository = inject(SOCIAL_FEED_REPOSITORY_TOKEN);
  private readonly storage = inject(STORAGE_REPOSITORY_TOKEN);
  private readonly directory = inject(PlayerDirectoryService);
  private readonly auth = inject(AuthService);
  private readonly friendRepository = inject(FRIEND_REPOSITORY_TOKEN);
  private readonly notify = inject(NotifyService);

  readonly authors = signal<ReadonlyMap<string, User>>(new Map());
  readonly mediaUrls = signal<ReadonlyMap<string, string>>(new Map());
  /** Nguoi dang duoc gui / chap nhan loi moi ket ban (khoa nut trong luc cho). */
  readonly pendingFriendIds = signal<ReadonlySet<string>>(new Set());

  /** Ban be, loi moi, da chan: tab Ban be, huy hieu so loi moi va goi y @nhac ten cung doc. */
  readonly connections = signal<Connections>(NO_CONNECTIONS);
  readonly connectionsLoading = signal(false);
  readonly connectionsError = signal(false);

  /** Chu de hay dung 30 ngay qua (goi y khi go "#"); tai mot lan khi nguoi dung go "#" lan dau. */
  readonly tagPool = signal<readonly string[]>([]);
  private tagPoolRequested = false;

  loadTagPool(): void {
    if (this.tagPoolRequested) return;
    this.tagPoolRequested = true;
    this.repository.getTagSuggestions(50).subscribe({
      next: tags => this.tagPool.set(tags.map(item => item.tag)),
      // Loi thi lan go "#" sau thu lai.
      error: () => { this.tagPoolRequested = false; }
    });
  }

  loadConnections(): void {
    this.connectionsLoading.set(true);
    this.connectionsError.set(false);
    forkJoin({
      friends: this.friendRepository.getFriends(),
      received: this.friendRepository.getPendingReceived(),
      sent: this.friendRepository.getPendingSent(),
      blocked: this.friendRepository.getBlockedUsers()
    }).pipe(finalize(() => this.connectionsLoading.set(false))).subscribe({
      next: result => {
        const blocked = result.blocked.data ?? [];
        const blockedIds = new Set(blocked.map(item => item.blockedUserId));
        const me = this.auth.currentUser?.userId ?? '';
        const connections: Connections = {
          friends: (result.friends.data ?? []).filter(item => !blockedIds.has(this.otherParty(item, me))),
          received: result.received.data ?? [],
          sent: result.sent.data ?? [],
          blocked
        };
        this.connections.set(connections);
        this.hydrateAuthors([
          ...[...connections.friends, ...connections.received, ...connections.sent].map(item => this.otherParty(item, me)),
          ...blocked.map(item => item.blockedUserId)
        ]);
      },
      error: () => this.connectionsError.set(true)
    });
  }

  /** Nguoi con lai trong mot quan he ban be. */
  otherParty(friendship: Friendship, me = this.auth.currentUser?.userId ?? ''): string {
    return friendship.requesterId === me ? friendship.addresseeId : friendship.requesterId;
  }

  friendIds(): string[] {
    return this.connections().friends.map(item => this.otherParty(item));
  }

  relation(userId: string): Relation {
    if (userId === this.auth.currentUser?.userId) return 'SELF';
    const connections = this.connections();
    if (connections.blocked.some(item => item.blockedUserId === userId)) return 'BLOCKED';
    if (connections.friends.some(item => this.otherParty(item) === userId)) return 'FRIEND';
    if (connections.sent.some(item => item.addresseeId === userId)) return 'SENT';
    if (connections.received.some(item => item.requesterId === userId)) return 'RECEIVED';
    return 'NONE';
  }

  /** Gui loi moi, hoac chap nhan loi moi nguoi kia da gui; xong thi tai lai ban be de moi nut cap nhat. */
  addFriend(userId: string): void {
    if (this.pendingFriendIds().has(userId)) return;
    const received = this.connections().received.find(item => item.requesterId === userId);
    const request$: Observable<unknown> = received
      ? this.friendRepository.respondFriendRequest(received.friendshipId, { accepted: true })
      : this.friendRepository.sendFriendRequest({ targetUserId: userId });
    const name = this.authorName(userId);
    this.pendingFriendIds.update(ids => new Set(ids).add(userId));
    request$.pipe(finalize(() => this.pendingFriendIds.update(ids => {
      const next = new Set(ids);
      next.delete(userId);
      return next;
    }))).subscribe({
      next: () => {
        this.notify.success(received ? `Bạn và ${name} đã là bạn bè.` : `Đã gửi lời mời kết bạn tới ${name}.`);
        this.loadConnections();
      },
      error: error => this.notify.error(errorMessage(error, 'Không thể gửi lời mời kết bạn.'))
    });
  }

  /** Nap tac gia va URL media cua cac bai (ca bai goc duoc chia se). */
  hydrate(posts: readonly SocialPost[]): void {
    const all = posts.flatMap(post => post.sharedPost ? [post, post.sharedPost] : [post]);
    this.hydrateAuthors([...all.map(post => post.authorId), ...all.flatMap(post => post.highlight?.tagged ?? [])]);

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
