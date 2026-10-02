import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { toDataURL } from 'qrcode';

@Component({
  selector: 'app-qr-code',
  templateUrl: './qr-code.component.html',
  styleUrls: ['./qr-code.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class QrCodeComponent implements OnChanges {
  private readonly changeDetector = inject(ChangeDetectorRef);
  private generation = 0;

  @Input() value: string = '';
  @Input() size: number = 180;
  @Input() title: string = 'Mã vé điện tử';

  qrSvgDataUrl: string = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] || changes['size']) {
      this.generateQr();
    }
  }

  async download(fileName: string): Promise<void> {
    if (!this.qrSvgDataUrl) throw new Error('QR code is unavailable');
    const response = await fetch(this.qrSvgDataUrl);
    if (!response.ok) throw new Error('QR code download failed');
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(blobUrl);
  }

  /**
   * Ve QR ngay tren may (thu vien qrcode, giong admin). Truoc day ma ve check-in duoc gui sang
   * api.qrserver.com: lo token cho ben thu ba va trong o QR khi dich vu do cham hoac bi chan.
   */
  private generateQr(): void {
    const generation = ++this.generation;
    if (!this.value) {
      this.qrSvgDataUrl = '';
      return;
    }
    toDataURL(this.value, {
      width: this.size * 2,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' }
    }).then(url => {
      if (generation !== this.generation) return;
      this.qrSvgDataUrl = url;
      this.changeDetector.markForCheck();
    }).catch(() => {
      if (generation !== this.generation) return;
      this.qrSvgDataUrl = '';
      this.changeDetector.markForCheck();
    });
  }
}
