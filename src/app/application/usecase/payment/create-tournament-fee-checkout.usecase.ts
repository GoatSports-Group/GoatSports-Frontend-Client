import { Inject, Injectable } from '@angular/core';
import { map, Observable, switchMap, throwError } from 'rxjs';
import { PaymentCheckout } from '@application/dto/payment/payment.dto';
import { PAYMENT_REPOSITORY_TOKEN, PaymentRepository } from '@application/ports/persistence/payment.repository';

@Injectable({ providedIn: 'root' })
export class CreateTournamentFeeCheckoutUseCase {
  constructor(@Inject(PAYMENT_REPOSITORY_TOKEN) private readonly repository: PaymentRepository) {}

  execute(registrationId: string, tournamentName: string, amount: number): Observable<PaymentCheckout> {
    if (!registrationId || amount <= 0) return throwError(() => new Error('Lệ phí giải đấu không hợp lệ.'));
    return this.repository.createPayment({
      referenceType: 'TOURNAMENT_REGISTRATION', referenceId: registrationId, purpose: 'TOURNAMENT_FEE',
      amount, currency: 'VND', description: `Lệ phí giải đấu ${tournamentName}`
    }, `tournament-fee:${registrationId}`).pipe(
      switchMap(payment => this.repository.createPaymentAttempt(payment.paymentId, { method: 'BANK_TRANSFER', locale: 'vn' })
        .pipe(map(attempt => ({ payment, attempt }))))
    );
  }
}
