import { ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, takeWhile, timer } from 'rxjs';
import { PaymentStatus } from '@application/dto/payment/payment.dto';
import { PAYMENT_REPOSITORY_TOKEN } from '@application/ports/persistence/payment.repository';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import { FeeCheckoutModel } from '@domain/models/tournament.model';
import { PendingBookingPaymentService } from '@presentation/services/pending-booking-payment.service';
import { NotifyService } from '@shared/components/notify/notify.service';

type Phase = 'loading' | 'waiting' | 'paid' | 'failed';

/**
 * Đóng lệ phí giải ngay trong trang: tạo (hoặc lấy lại) mã VietQR của payOS, hiện QR và tự kiểm tra trạng thái,
 * giống bước thanh toán cọc khi đặt sân. Đóng hộp thoại không hủy thanh toán; mở lại sẽ dùng lại cùng một mã.
 */
@Component({
  selector: 'app-fee-payment-dialog',
  templateUrl: './fee-payment-dialog.component.html',
  styleUrls: ['./fee-payment-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class FeePaymentDialogComponent implements OnInit {
  @Input({ required: true }) tournamentId!: string;
  @Input({ required: true }) registrationId!: string;
  @Input() tournamentName = '';
  @Input() teamName = '';
  /** true khi đã thanh toán xong. */
  @Output() readonly closed = new EventEmitter<boolean>();

  private readonly repository = inject(TournamentRepositoryPort);
  private readonly payments = inject(PAYMENT_REPOSITORY_TOKEN);
  private readonly pendingPayment = inject(PendingBookingPaymentService);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  readonly phase = signal<Phase>('loading');
  readonly checkout = signal<FeeCheckoutModel | null>(null);
  readonly status = signal<PaymentStatus | null>(null);
  readonly failure = signal('');
  private readonly now = signal(Date.now());

  readonly hasQr = computed(() => !!this.checkout()?.qrCodeContent?.startsWith('data:image/'));
  readonly countdown = computed(() => {
    const expiresAt = this.checkout()?.expiresAt;
    if (!expiresAt) return '';
    const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - this.now()) / 1000));
    const hours = Math.floor(left / 3600);
    const minutes = Math.floor((left % 3600) / 60);
    const seconds = left % 60;
    const pad = (value: number) => String(value).padStart(2, '0');
    return hours ? `${hours} giờ ${pad(minutes)} phút` : `${pad(minutes)}:${pad(seconds)}`;
  });

  ngOnInit(): void {
    timer(0, 1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.now.set(Date.now()));
    this.start();
  }

  /** Số tiền và người nhận do server tính; client chỉ hiện mã. */
  start(): void {
    this.phase.set('loading');
    this.failure.set('');
    this.repository.checkout(this.tournamentId, this.registrationId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: checkout => {
        this.checkout.set(checkout);
        this.pendingPayment.save({ kind: 'TOURNAMENT', tournamentId: this.tournamentId,
          registrationId: this.registrationId, paymentId: checkout.paymentId });
        this.phase.set('waiting');
        this.poll(checkout.paymentId);
      },
      error: error => {
        this.phase.set('failed');
        this.failure.set(error?.error?.message ?? 'Không tạo được mã thanh toán lệ phí. Thử lại sau ít phút.');
      }
    });
  }

  close(): void {
    this.closed.emit(this.phase() === 'paid');
  }

  async copyAmount(): Promise<void> {
    const amount = this.checkout()?.amount;
    if (amount == null) return;
    try {
      await navigator.clipboard.writeText(String(Math.round(amount)));
      this.notify.success('Đã sao chép số tiền.');
    } catch {
      this.notify.warning('Không sao chép được, hãy nhập đúng số tiền hiển thị.');
    }
  }

  formatVnd(amount: number | undefined): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount ?? 0);
  }

  private poll(paymentId: string): void {
    timer(2000, 2000).pipe(
      switchMap(() => this.payments.getPayment(paymentId).pipe(catchError(() => of(null)))),
      takeWhile(payment => !payment || payment.status === 'CREATED' || payment.status === 'PENDING', true),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(payment => {
      if (!payment) return;
      this.status.set(payment.status);
      if (payment.status === 'SUCCEEDED') {
        this.pendingPayment.clear();
        this.phase.set('paid');
      } else if (payment.status !== 'CREATED' && payment.status !== 'PENDING') {
        this.phase.set('failed');
        this.failure.set(payment.status === 'EXPIRED'
          ? 'Mã thanh toán đã hết hạn.'
          : payment.failureReason || 'Giao dịch không thành công hoặc đã bị hủy.');
      }
    });
  }
}
