import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, finalize, of, take, takeWhile, timer, switchMap } from 'rxjs';
import { Payment, PaymentStatus } from '@application/dto/payment/payment.dto';
import {
  PAYMENT_REPOSITORY_TOKEN,
  PaymentRepository
} from '@application/ports/persistence/payment.repository';
import {
  PendingBookingPayment,
  PendingBookingPaymentService
} from '@presentation/services/pending-booking-payment.service';

type PaymentResultState = 'checking' | 'success' | 'cancelled' | 'failed' | 'pending' | 'missing';

@Component({
  selector: 'app-payment-result',
  templateUrl: './payment-result.component.html',
  styleUrls: ['./payment-result.component.scss'],
  standalone: false
})
export class PaymentResultComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly paymentRepository: PaymentRepository = inject(PAYMENT_REPOSITORY_TOKEN);
  private readonly pendingPayment = inject(PendingBookingPaymentService);
  private readonly destroyRef = inject(DestroyRef);

  context: PendingBookingPayment | null = null;
  payment: Payment | null = null;
  state: PaymentResultState = 'checking';
  checking = false;

  ngOnInit(): void {
    this.context = this.pendingPayment.get();
    if (this.route.snapshot.data['paymentResult'] === 'cancelled') {
      this.state = 'cancelled';
      return;
    }
    if (!this.context) {
      this.state = 'missing';
      return;
    }
    this.checkPayment();
  }

  checkPayment(): void {
    if (!this.context || this.checking) return;
    this.checking = true;
    this.state = 'checking';

    timer(0, 1500).pipe(
      switchMap(() => this.paymentRepository.getPayment(this.context!.paymentId).pipe(
        catchError(() => of(null))
      )),
      take(20),
      takeWhile(payment => payment == null || this.isProcessing(payment.status), true),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.checking = false;
        if (this.state === 'checking') this.state = 'pending';
      })
    ).subscribe(payment => {
      if (!payment) return;
      this.payment = payment;
      if (payment.status === 'SUCCEEDED') {
        this.state = 'success';
      } else if (!this.isProcessing(payment.status)) {
        this.state = 'failed';
      }
    });
  }

  get bookingUrl(): string {
    return this.context ? `/booking/detail/${this.context.bookingId}` : '/booking/history';
  }

  formatPrice(value?: number): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency', currency: 'VND', maximumFractionDigits: 0
    }).format(value);
  }

  private isProcessing(status: PaymentStatus): boolean {
    return status === 'CREATED' || status === 'PENDING';
  }
}
