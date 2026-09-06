import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  CreatePaymentAttemptRequest,
  CreatePaymentRequest,
  Payment,
  PaymentAttempt
} from '@application/dto/payment/payment.dto';
import { PaymentRepository } from '@application/ports/persistence/payment.repository';
import { PaymentApi } from '@infrastructure/api/payment.api';

@Injectable({ providedIn: 'root' })
export class PaymentRepositoryImpl implements PaymentRepository {
  private readonly api = inject(PaymentApi);

  createPayment(request: CreatePaymentRequest, idempotencyKey: string): Observable<Payment> {
    return this.api.createPayment(request, idempotencyKey).pipe(
      map(response => this.requireData(response.data))
    );
  }

  createPaymentAttempt(
    paymentId: string,
    request: CreatePaymentAttemptRequest
  ): Observable<PaymentAttempt> {
    return this.api.createPaymentAttempt(paymentId, request).pipe(
      map(response => this.requireData(response.data))
    );
  }

  getPayment(paymentId: string): Observable<Payment> {
    return this.api.getPayment(paymentId).pipe(
      map(response => this.requireData(response.data))
    );
  }

  private requireData<T>(data: T | null | undefined): T {
    if (data == null) throw new Error('Payment service không trả dữ liệu.');
    return data;
  }
}
