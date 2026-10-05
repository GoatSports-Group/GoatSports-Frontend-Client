import { PAGE_SIZE } from '@shared/constants/page-size';
import { Directive, ElementRef, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';

/** So dong hien them moi lan cham day voi danh sach da co san o client. */
export const LIST_CHUNK = PAGE_SIZE.streamLight;

/**
 * Dat tren phan tu "sentinel" cuoi danh sach: phat `reached` khi no sap vao man hinh.
 * Sau moi lan phat, quan sat lai o frame sau: neu sentinel van trong tam (danh sach ngan)
 * thi phat tiep cho toi khi day khung. Ben goi tu chan khi dang tai (hoac an sentinel).
 * Goc quan sat la khung cuon gan nhat (cot giua Cong dong, than popup...), khong co thi la cua so: nho vay
 * "sap vao man hinh" (400px) tinh dung trong khung dang cuon.
 */
@Directive({
  selector: '[appInfiniteScroll]',
  standalone: false
})
export class InfiniteScrollDirective implements OnInit, OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;

  @Output() readonly reached = new EventEmitter<void>();

  ngOnInit(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    // Cho mot nhip de sentinel da gan vao DOM, roi moi tim khung cuon cua no.
    queueMicrotask(() => this.start());
  }

  private start(): void {
    if (this.destroyed) return;
    this.observer?.disconnect();
    this.observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      this.reached.emit();
      // Quan sat lai o frame sau, tim lai khung cuon (danh sach vua dai ra co the da bat dau cuon).
      this.observer?.disconnect();
      requestAnimationFrame(() => this.start());
    }, { root: scrollParent(this.element.nativeElement), rootMargin: '400px 0px' });
    this.observer.observe(this.element.nativeElement);
  }

  private destroyed = false;

  ngOnDestroy(): void {
    this.destroyed = true;
    this.observer?.disconnect();
    this.observer = undefined;
  }
}

/**
 * Phan tu to tien gan nhat THUC SU cuon doc; null = cua so. Chi xet overflow-y la chua du: phan tu chi cuon ngang
 * (overflow-x: auto) cung bi tinh overflow-y = auto, va mot khung chua bi gioi han chieu cao thi luon "thay" sentinel,
 * khien danh sach tai het mot lan.
 */
function scrollParent(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight + 1) return node;
  }
  return null;
}
