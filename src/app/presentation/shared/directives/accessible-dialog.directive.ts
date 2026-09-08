import { FocusTrap, FocusTrapFactory } from '@angular/cdk/a11y';
import { AfterViewInit, Directive, ElementRef, EventEmitter, HostBinding, HostListener, OnDestroy, Output, inject } from '@angular/core';

@Directive({
  selector: '[appAccessibleDialog]',
  standalone: false
})
export class AccessibleDialogDirective implements AfterViewInit, OnDestroy {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly focusTrapFactory = inject(FocusTrapFactory);
  private readonly previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  private focusTrap?: FocusTrap;

  @HostBinding('attr.role') readonly role = 'dialog';
  @HostBinding('attr.aria-modal') readonly ariaModal = 'true';
  @Output() readonly dialogClosed = new EventEmitter<void>();

  ngAfterViewInit(): void {
    this.focusTrap = this.focusTrapFactory.create(this.elementRef.nativeElement);
    void this.focusTrap.focusInitialElementWhenReady();
  }

  ngOnDestroy(): void {
    this.focusTrap?.destroy();
    this.previouslyFocused?.focus();
  }

  @HostListener('document:keydown.escape', ['$event'])
  closeFromKeyboard(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.dialogClosed.emit();
  }
}
