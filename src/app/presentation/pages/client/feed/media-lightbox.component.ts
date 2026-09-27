import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output, computed, signal } from '@angular/core';
import { AttachmentType } from '@application/dto/social-feed/social-feed.dto';

export interface LightboxItem {
  url: string;
  type: AttachmentType;
}

/** Xem anh / video cua mot bai o kich thuoc lon: ←/→ doi anh, Esc dong, vuot ngang tren dien thoai. */
@Component({
  selector: 'app-media-lightbox',
  templateUrl: './media-lightbox.component.html',
  styleUrls: ['./media-lightbox.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class MediaLightboxComponent {
  private readonly itemsState = signal<LightboxItem[]>([]);
  readonly index = signal(0);
  private touchStartX: number | null = null;

  @Input({ required: true }) set items(value: LightboxItem[]) { this.itemsState.set(value); }
  @Input() set start(value: number) { this.index.set(value); }
  @Input() caption = '';
  @Output() readonly closed = new EventEmitter<void>();

  readonly list = this.itemsState.asReadonly();
  readonly current = computed(() => this.itemsState()[this.index()] ?? null);

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') this.step(1);
    if (event.key === 'ArrowLeft') this.step(-1);
  }

  step(delta: number): void {
    const count = this.itemsState().length;
    if (count > 1) this.index.set((this.index() + delta + count) % count);
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0]?.clientX ?? null;
  }

  onTouchEnd(event: TouchEvent): void {
    if (this.touchStartX === null) return;
    const dx = (event.changedTouches[0]?.clientX ?? this.touchStartX) - this.touchStartX;
    if (Math.abs(dx) > 48) this.step(dx < 0 ? 1 : -1);
    this.touchStartX = null;
  }
}
