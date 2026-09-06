import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CreatePaymentAttemptRequest,
  CreatePaymentRequest,
  Payment,
  PaymentAttempt
} from '@application/dto/payment/payment.dto';

export interface PaymentRepository {
  createPayment(request: CreatePaymentRequest, idempotencyKey: string): Observable<Payment>;
  createPaymentAttempt(paymentId: string, request: CreatePaymentAttemptRequest): Observable<PaymentAttempt>;
  getPayment(paymentId: string): Observable<Payment>;
}

export const PAYMENT_REPOSITORY_TOKEN = new InjectionToken<PaymentRepository>(
  'PAYMENT_REPOSITORY_TOKEN'
);
