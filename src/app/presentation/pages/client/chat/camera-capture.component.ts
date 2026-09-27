import {
  ChangeDetectionStrategy, Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild, signal
} from '@angular/core';

type CameraState = 'starting' | 'live' | 'preview' | 'error';

/**
 * Mo camera, chup va xem lai truoc khi gui. Dung getUserMedia (desktop va dien thoai); neu trinh duyet
 * khong ho tro hoac nguoi dung tu choi quyen thi mo trinh chup anh cua he dieu hanh qua
 * <input type="file" capture>, ket qua cung la mot File nhu nhau.
 */
@Component({
  selector: 'app-camera-capture',
  templateUrl: './camera-capture.component.html',
  styleUrls: ['./camera-capture.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class CameraCaptureComponent implements OnInit, OnDestroy {
  @Output() readonly captured = new EventEmitter<File>();
  @Output() readonly closed = new EventEmitter<void>();
  @ViewChild('video') private video?: ElementRef<HTMLVideoElement>;

  readonly state = signal<CameraState>('starting');
  readonly error = signal('');
  readonly facing = signal<'environment' | 'user'>('environment');
  readonly canSwitch = signal(false);
  readonly shotUrl = signal<string | null>(null);
  private shot: Blob | null = null;
  private stream: MediaStream | null = null;

  ngOnInit(): void {
    void this.start();
  }

  ngOnDestroy(): void {
    this.stop();
    this.clearShot();
  }

  async start(): Promise<void> {
    this.stop();
    this.state.set('starting');
    if (!navigator.mediaDevices?.getUserMedia) {
      this.fail('Trình duyệt này không mở được camera trực tiếp. Dùng nút bên dưới để chụp bằng ứng dụng máy ảnh.');
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: this.facing() }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.canSwitch.set(devices.filter(device => device.kind === 'videoinput').length > 1);
      this.state.set('live');
      queueMicrotask(() => {
        const element = this.video?.nativeElement;
        if (element && this.stream) {
          element.srcObject = this.stream;
          void element.play();
        }
      });
    } catch (error) {
      const name = (error as DOMException)?.name;
      this.fail(name === 'NotAllowedError'
        ? 'Bạn chưa cho phép dùng camera. Bật quyền camera cho trang này trong cài đặt trình duyệt, hoặc chụp bằng ứng dụng máy ảnh.'
        : name === 'NotFoundError'
          ? 'Không tìm thấy camera trên thiết bị này.'
          : 'Không mở được camera. Camera có thể đang được ứng dụng khác sử dụng.');
    }
  }

  switchCamera(): void {
    this.facing.update(value => value === 'environment' ? 'user' : 'environment');
    void this.start();
  }

  capture(): void {
    const element = this.video?.nativeElement;
    if (!element || !element.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    const context = canvas.getContext('2d')!;
    // Camera truoc hien nhu guong; anh chup giu dung chieu nhu nguoi khac nhin thay.
    context.drawImage(element, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      this.shot = blob;
      this.shotUrl.set(URL.createObjectURL(blob));
      this.state.set('preview');
      this.stop();
    }, 'image/jpeg', 0.9);
  }

  retake(): void {
    this.clearShot();
    void this.start();
  }

  use(): void {
    if (!this.shot) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.captured.emit(new File([this.shot], `camera-${stamp}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
  }

  /** Duong du phong: trinh chup anh cua he dieu hanh. */
  onNativeCapture(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.captured.emit(file);
  }

  private fail(message: string): void {
    this.stop();
    this.error.set(message);
    this.state.set('error');
  }

  private stop(): void {
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
  }

  private clearShot(): void {
    const url = this.shotUrl();
    if (url) URL.revokeObjectURL(url);
    this.shotUrl.set(null);
    this.shot = null;
  }
}
