import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { PostHighlight } from '@application/dto/social-feed/social-feed.dto';
import { CommunityStore } from './community.store';

/** So nguoi duoc gan the hien ten; con lai gom thanh "+N". */
const SHOWN_TAGS = 5;

/**
 * The "khoe" trong bai viet: tran ghep bang AI (bang ty so hai ben) hoac thanh tich giai cua CLB, kem nguoi duoc
 * gan the. Du lieu do ai-service / club-service dung, client chi hien thi.
 */
@Component({
  selector: 'app-post-highlight',
  templateUrl: './post-highlight.component.html',
  styleUrls: ['./post-highlight.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class PostHighlightComponent {
  readonly store = inject(CommunityStore);
  @Input({ required: true }) highlight!: PostHighlight;

  get isMatch(): boolean {
    return this.highlight.kind === 'MATCH';
  }

  /** Mau cua dong ket qua: thang / vo dich noi bat, con lai trung tinh. */
  get tone(): 'win' | 'gold' | 'neutral' {
    const result = this.highlight.result ?? '';
    if (result.startsWith('Vô địch')) return 'gold';
    if (result.startsWith('Thắng') || result.startsWith('Hạng 1/')) return 'win';
    return 'neutral';
  }

  get scored(): boolean {
    return this.highlight.sides.length === 2 && this.highlight.sides.every(side => side.score !== null);
  }

  get shownTags(): readonly string[] {
    return this.highlight.tagged.slice(0, SHOWN_TAGS);
  }

  get moreTags(): number {
    return Math.max(0, this.highlight.tagged.length - SHOWN_TAGS);
  }
}
