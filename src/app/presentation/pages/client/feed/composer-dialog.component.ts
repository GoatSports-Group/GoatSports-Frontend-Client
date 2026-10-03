import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { PostSport, SocialPost } from '@application/dto/social-feed/social-feed.dto';
import { PlayerCallPrefill } from './post-composer.component';

/**
 * O soan bai trong hop thoai: dang keo / bai viet moi (tu thanh rut gon, "Tao keo") va chinh sua bai (menu ⋯).
 * Thanh nut cua o soan dinh o day hop thoai nen form keo dai van thay "Dang".
 */
@Component({
  selector: 'app-composer-dialog',
  templateUrl: './composer-dialog.component.html',
  styleUrls: ['./composer-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class ComposerDialogComponent {
  /** Bai dang sua; null la soan moi. */
  @Input() post: SocialPost | null = null;
  @Input() initialKind: 'CALL' | 'POST' | null = null;
  @Input() defaultSport: PostSport | null = null;
  @Input() prefill: PlayerCallPrefill | null = null;
  @Output() readonly saved = new EventEmitter<SocialPost>();
  @Output() readonly closed = new EventEmitter<void>();
}
