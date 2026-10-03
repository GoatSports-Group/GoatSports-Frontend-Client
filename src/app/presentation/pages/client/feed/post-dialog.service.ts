import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { SocialPost } from '@application/dto/social-feed/social-feed.dto';

export interface OpenPost {
  postId: string;
  /** Bai da co san (bam tu bang tin) thi hien ngay, khong tai lai. */
  post: SocialPost | null;
  /** Dua con tro vao o binh luan (bam "Binh luan"). */
  focusComments: boolean;
}

/**
 * Mo mot bai viet trong popup o bat ky trang nao (thay cho trang /feed/posts/:id). Host popup nam o layout client.
 * Bang tin nghe `changes` / `removals` de cap nhat the tuong ung khi nguoi dung thich, binh luan, sua, xoa trong popup.
 */
@Injectable({ providedIn: 'root' })
export class PostDialogService {
  readonly current = signal<OpenPost | null>(null);
  readonly changes = new Subject<SocialPost>();
  readonly removals = new Subject<string>();
  /** Bai chia se vua tao tu popup: bang tin dua len dau neu hop bo loc. */
  readonly published = new Subject<SocialPost>();

  open(target: SocialPost | string, focusComments = false): void {
    const post = typeof target === 'string' ? null : target;
    this.current.set({ postId: post?.postId ?? (target as string), post, focusComments });
  }

  close(): void {
    this.current.set(null);
  }
}
