import { DOCUMENT } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';

@Component({
  selector: 'app-screen-loader',
  templateUrl: './screen-loader.component.html',
  styleUrls: ['./screen-loader.component.scss'],
  standalone: false
})
export class ScreenLoaderComponent implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private previousOverflow = '';
  private previousPaddingRight = '';

  @Input() title = 'Đang xử lý';
  @Input() message = 'Vui lòng không đóng hoặc tải lại trang.';

  ngOnInit(): void {
    const body = this.document.body;
    const scrollbarWidth = window.innerWidth - this.document.documentElement.clientWidth;

    this.previousOverflow = body.style.overflow;
    this.previousPaddingRight = body.style.paddingRight;
    body.style.overflow = 'hidden';

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  ngOnDestroy(): void {
    const body = this.document.body;
    body.style.overflow = this.previousOverflow;
    body.style.paddingRight = this.previousPaddingRight;
  }
}
