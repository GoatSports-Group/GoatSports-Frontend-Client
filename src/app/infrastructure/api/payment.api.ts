import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import {
  CreatePaymentAttemptRequest,
  CreatePaymentRequest,
  Payment,
  PaymentAttempt
} from '@application/dto/payment/payment.dto';
import { API_ENDPOINTS } from '@infrastructure/config/api-endpoints';

@Injectable({ providedIn: 'root' })
export class PaymentApi {
  private readonly http = inject(HttpClient);
  private readonly apiBase = `${API_ENDPOINTS.payment}/payments`;

  createPayment(
    request: CreatePaymentRequest,
    idempotencyKey: string
  ): Observable<BaseResponse<Payment>> {
    return this.http.post<BaseResponse<Payment>>(this.apiBase, request, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey })
    });
  }

  createPaymentAttempt(
    paymentId: string,
    request: CreatePaymentAttemptRequest
  ): Observable<BaseResponse<PaymentAttempt>> {
    return this.http.post<BaseResponse<PaymentAttempt>>(
      `${this.apiBase}/${paymentId}/attempts`,
      request
    );
  }

  getPayment(paymentId: string): Observable<BaseResponse<Payment>> {
    return this.http.get<BaseResponse<Payment>>(`${this.apiBase}/${paymentId}`);
  }
}
