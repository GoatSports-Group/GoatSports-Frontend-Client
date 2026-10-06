import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { PostHighlight } from '@application/dto/social-feed/social-feed.dto';

/**
 * The "khoe" trong bai viet: tran ghep bang AI (bang ty so hai ben) hoac thanh tich giai cua CLB. Nguoi duoc gan the
 * hien o dong ten tac gia cua the bai viet. Du lieu do ai-service / club-service dung, client chi hien thi.
 */
@Component({
  selector: 'app-post-highlight',
  templateUrl: './post-highlight.component.html',
  styleUrls: ['./post-highlight.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class PostHighlightComponent {
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
}
