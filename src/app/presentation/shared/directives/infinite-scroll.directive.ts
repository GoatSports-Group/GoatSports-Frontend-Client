import { Directive, ElementRef, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';

/** So dong hien them moi lan cham day voi danh sach da co san o client. */
export const LIST_CHUNK = 20;

/**
 * Dat tren phan tu "sentinel" cuoi danh sach: phat `reached` khi no sap vao man hinh.
 * Sau moi lan phat, quan sat lai o frame sau: neu sentinel van trong tam (danh sach ngan)
 * thi phat tiep cho toi khi day khung. Ben goi tu chan khi dang tai (hoac an sentinel).
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
    this.observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      this.reached.emit();
      this.observer?.unobserve(this.element.nativeElement);
      requestAnimationFrame(() => this.observer?.observe(this.element.nativeElement));
    }, { rootMargin: '400px 0px' });
    this.observer.observe(this.element.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = undefined;
  }
}
