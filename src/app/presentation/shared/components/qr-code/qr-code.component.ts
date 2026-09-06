import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-qr-code',
  templateUrl: './qr-code.component.html',
  styleUrls: ['./qr-code.component.scss'],
  standalone: false
})
export class QrCodeComponent implements OnChanges {
  @Input() value: string = '';
  @Input() size: number = 180;
  @Input() title: string = 'Mã vé điện tử';

  qrSvgDataUrl: string = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] || changes['size']) {
      this.generateQr();
    }
  }

  private generateQr(): void {
    if (!this.value) {
      this.qrSvgDataUrl = '';
      return;
    }
    // Encode string to QR code using public lightweight API / data URI SVG
    const encoded = encodeURIComponent(this.value);
    this.qrSvgDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${this.size}x${this.size}&data=${encoded}&color=0f172a&bgcolor=ffffff&margin=1`;
  }
}
