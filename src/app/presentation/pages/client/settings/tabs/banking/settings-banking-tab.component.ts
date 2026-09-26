import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, from, Observable, of } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
import { BankAccount, BankDirectoryEntry, LinkBankAccountRequest, MyRefund } from '@application/dto/payment/bank-account.dto';
import { EncryptedPayload } from '@application/dto/security/encrypted-payload.dto';
import { BANK_ACCOUNT_REPOSITORY_TOKEN, BankAccountRepository } from '@application/ports/persistence/bank-account.repository';
import { NotifyService } from '@shared/components/notify/notify.service';
import { SelectOption } from '@shared/components/ui/select/select.component';
import { CryptoService } from '@presentation/services/crypto.service';

@Component({ selector: 'app-settings-banking-tab', templateUrl: './settings-banking-tab.component.html', styleUrls: ['./settings-banking-tab.component.scss'], changeDetection: ChangeDetectionStrategy.OnPush, standalone: false })
export class SettingsBankingTabComponent {
  private readonly repository: BankAccountRepository = inject(BANK_ACCOUNT_REPOSITORY_TOKEN);
  private readonly notify = inject(NotifyService);
  private readonly cryptoService = inject(CryptoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly banks = signal<BankDirectoryEntry[]>([]);
  readonly accounts = signal<BankAccount[]>([]);
  /** Khoản hoàn tiền (lệ phí giải, cọc đặt sân...) của người chơi. */
  readonly refunds = signal<MyRefund[]>([]);
  readonly claimingId = signal<string | null>(null);
  readonly hasUsableAccount = computed(() => this.accounts().some(item => item.status !== 'REJECTED' && item.status !== 'DISABLED'));
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showForm = signal(false);
  bankBin = '';
  accountNumber = '';
  accountName = '';
  readonly refundContext = this.route.snapshot.queryParamMap.get('reason') === 'refund';
  readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

  constructor() { this.load(); }

  /** Searchable bank picker: app-select filters on the label, so it carries short name + full name. */
  readonly bankOptions = computed<SelectOption[]>(() =>
    this.banks().map(bank => ({ value: bank.bin, label: `${bank.shortName} · ${bank.name}` })));
  getBank(bankBin: string): BankDirectoryEntry | undefined { return this.banks().find(bank => bank.bin === bankBin); }
  load(): void {
    this.loading.set(true);
    forkJoin({
      banks: this.repository.getBanks(),
      accounts: this.repository.getMyAccounts(),
      refunds: this.repository.getMyRefunds().pipe(catchError(() => of([] as MyRefund[])))
    }).pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => {
          this.banks.set(result.banks); this.accounts.set(result.accounts); this.refunds.set(result.refunds);
          this.showForm.set(result.accounts.length === 0);
        },
        error: error => this.notify.error(error?.error?.message || 'Không thể tải thông tin ngân hàng.')
      });
  }
  submit(): void {
    const request: LinkBankAccountRequest = { bankBin: this.bankBin, accountNumber: this.accountNumber.replace(/\s/g, ''), accountName: this.accountName.trim() };
    if (!/^\d{6,19}$/.test(request.accountNumber) || !request.bankBin || !request.accountName) { this.notify.error('Vui lòng chọn ngân hàng và nhập đúng thông tin tài khoản.'); return; }
    this.saving.set(true);
    this.encryptBankingPayload(request).pipe(
      switchMap(encryptedPayload => this.repository.link(encryptedPayload)),
      finalize(() => this.saving.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: account => { this.accounts.update(accounts => [account, ...accounts]); this.resetForm(); this.reloadRefunds(); this.notify.success(this.refundContext ? 'Đã liên kết. Khoản hoàn tự động sẽ được chuyển khi payOS xác minh tài khoản.' : 'Đã liên kết tài khoản. payOS sẽ xác minh ở giao dịch đầu tiên.'); },
      error: error => this.notify.error(error?.error?.message || 'Không thể liên kết tài khoản ngân hàng.')
    });
  }
  makeDefault(account: BankAccount): void {
    if (account.isDefault) return;
    this.encryptBankingPayload({ bankAccountId: account.bankAccountId }).pipe(
      switchMap(encryptedPayload => this.repository.makeDefault(encryptedPayload)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: updated => this.accounts.update(accounts => accounts.map(item => ({ ...item, isDefault: item.bankAccountId === updated.bankAccountId }))),
      error: error => this.notify.error(error?.error?.message || 'Không thể đổi tài khoản mặc định.')
    });
  }
  disable(account: BankAccount): void {
    if (!window.confirm(`Ngừng sử dụng tài khoản ****${account.accountNumberLast4}?`)) return;
    this.encryptBankingPayload({ bankAccountId: account.bankAccountId }).pipe(
      switchMap(encryptedPayload => this.repository.disable(encryptedPayload)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => { this.accounts.update(accounts => accounts.filter(item => item.bankAccountId !== account.bankAccountId)); this.notify.success('Đã ngừng sử dụng tài khoản ngân hàng.'); },
      error: error => this.notify.error(error?.error?.message || 'Không thể gỡ tài khoản ngân hàng.')
    });
  }
  /** Nhận khoản hoàn (hoặc thử lại khi lần chuyển trước lỗi): payment-service chuyển về tài khoản mặc định. */
  claim(refund: MyRefund): void {
    if (this.claimingId()) return;
    if (!this.hasUsableAccount()) { this.showForm.set(true); this.notify.warning('Liên kết tài khoản ngân hàng trước để nhận hoàn tiền.'); return; }
    this.claimingId.set(refund.refundId);
    this.repository.claimRefund(refund.refundId).pipe(finalize(() => this.claimingId.set(null)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.refunds.update(items => items.map(item => item.refundId === refund.refundId
          ? { ...item, status: result.status, failureReason: result.failureReason, claimable: result.status === 'FAILED' } : item));
        if (result.status === 'SUCCEEDED') this.notify.success('Đã hoàn tiền về tài khoản của bạn.');
        else if (result.status === 'FAILED') this.notify.error(result.failureReason || 'Chuyển tiền chưa thành công, thử lại sau ít phút.');
        else this.notify.success('Đang chuyển tiền hoàn về tài khoản của bạn.');
      },
      error: error => { this.notify.error(error?.error?.message || 'Chưa nhận được hoàn tiền, thử lại sau.'); this.reloadRefunds(); }
    });
  }
  refundTitle(refund: MyRefund): string {
    if (refund.description) return refund.description;
    return refund.purpose === 'TOURNAMENT_FEE' ? 'Lệ phí giải đấu' : 'Tiền đặt sân';
  }
  refundTone(status: MyRefund['status']): string {
    return ({ SUCCEEDED: 'success', FAILED: 'danger', PROCESSING: 'info', PENDING: 'info', AWAITING_CLAIM: 'warning',
      AWAITING_BANK_ACCOUNT: 'warning', MANUAL_REVIEW: 'neutral', CREATED: 'neutral' } as const)[status] ?? '';
  }
  refundLabel(status: MyRefund['status']): string {
    return ({ SUCCEEDED: 'Đã hoàn', FAILED: 'Chuyển lỗi', PROCESSING: 'Đang chuyển', PENDING: 'Đang chuyển', AWAITING_CLAIM: 'Chờ bạn nhận',
      AWAITING_BANK_ACCOUNT: 'Chờ liên kết ngân hàng', MANUAL_REVIEW: 'Đang xử lý thủ công', CREATED: 'Đang tạo' } as const)[status] ?? status;
  }
  formatVnd(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount ?? 0);
  }
  private reloadRefunds(): void {
    this.repository.getMyRefunds().pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe(items => { if (items) this.refunds.set(items); });
  }
  continueFlow(): void { if (this.returnUrl) void this.router.navigateByUrl(this.returnUrl); }
  statusTone(status: BankAccount['status']): string {
    return { PENDING_VERIFICATION: 'warning', VERIFIED: 'success', REJECTED: 'danger', DISABLED: '' }[status];
  }
  statusLabel(status: BankAccount['status']): string {
    return { PENDING_VERIFICATION: 'Chờ xác minh', VERIFIED: 'Đã xác minh', REJECTED: 'Xác minh lỗi', DISABLED: 'Ngừng dùng' }[status];
  }
  private encryptBankingPayload(payload: object): Observable<EncryptedPayload> {
    return this.repository.getEncryptionPublicKey().pipe(
      switchMap(publicKey => from(this.cryptoService.encryptPayload(payload, publicKey)))
    );
  }
  private resetForm(): void { this.bankBin = ''; this.accountNumber = ''; this.accountName = ''; this.showForm.set(false); }
}
