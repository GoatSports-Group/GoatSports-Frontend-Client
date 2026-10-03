import {
  ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, Input, OnInit, Output, computed, inject, signal
} from '@angular/core';
import { PostDialogService } from './post-dialog.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize } from 'rxjs';
import { errorMessage } from './community-view';

/** Tom tat hien trong hop thoai: nguoi dung thay minh sap khoe cai gi truoc khi dang. */
export interface HighlightSummary {
  icon: string;
  headline: string;
  line: string;
  result?: string | null;
}

export const HIGHLIGHT_TITLE_MAX = 120;
export const HIGHLIGHT_CONTENT_MAX = 2000;

/**
 * Hop thoai "Khoe len Cong dong" dung chung cho tran ghep AI va thanh tich giai cua CLB. Nguoi dung chi viet tieu de
 * va loi dan; the thanh tich do dich vu so huu du lieu dung (xem {@link submit}).
 */
@Component({
  selector: 'app-highlight-share-dialog',
  templateUrl: './highlight-share-dialog.component.html',
  styleUrls: ['./highlight-share-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class HighlightShareDialogComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly postDialog = inject(PostDialogService);

  @Input({ required: true }) heading = '';
  @Input({ required: true }) summary!: HighlightSummary;
  /** Ai duoc gan the va nhan thong bao, vd "Thang Dat duoc gan the va nhan thong bao." */
  @Input() taggedNote = '';
  @Input() defaultTitle = '';
  /** Goi API dang bai; tra id bai viet. */
  @Input({ required: true }) submit!: (title: string, content: string | null) => Observable<string>;
  @Output() readonly closed = new EventEmitter<void>();

  readonly titleMax = HIGHLIGHT_TITLE_MAX;
  readonly contentMax = HIGHLIGHT_CONTENT_MAX;
  readonly title = signal('');
  readonly content = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  /** Dang xong: hop thoai chuyen sang trang thai thanh cong voi link toi bai. */
  readonly postId = signal<string | null>(null);
  readonly canSubmit = computed(() => !this.busy() && this.title().trim().length > 0
    && this.title().length <= HIGHLIGHT_TITLE_MAX && this.content().length <= HIGHLIGHT_CONTENT_MAX);

  ngOnInit(): void {
    this.title.set(this.defaultTitle.slice(0, HIGHLIGHT_TITLE_MAX));
  }

  publish(): void {
    if (!this.canSubmit()) return;
    this.busy.set(true);
    this.error.set(null);
    this.submit(this.title().trim(), this.content().trim() || null).pipe(
      finalize(() => this.busy.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: postId => this.postId.set(postId),
      error: error => this.error.set(errorMessage(error, 'Chưa đăng được lên Cộng đồng. Thử lại sau ít phút.'))
    });
  }

  /** Dong hop thoai khoe va mo bai vua dang trong popup bai viet. */
  viewPost(postId: string): void {
    this.closed.emit();
    this.postDialog.open(postId);
  }

  close(): void {
    if (!this.busy()) this.closed.emit();
  }
}
