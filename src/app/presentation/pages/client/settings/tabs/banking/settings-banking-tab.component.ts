import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { BankAccount, BankDirectoryEntry, LinkBankAccountRequest } from '@application/dto/payment/bank-account.dto';
import { BANK_ACCOUNT_REPOSITORY_TOKEN, BankAccountRepository } from '@application/ports/persistence/bank-account.repository';
import { NotifyService } from '@shared/components/notify/notify.service';

@Component({ selector: 'app-settings-banking-tab', templateUrl: './settings-banking-tab.component.html', styleUrls: ['./settings-banking-tab.component.scss'], changeDetection: ChangeDetectionStrategy.OnPush, standalone: false })
export class SettingsBankingTabComponent {
  private readonly repository: BankAccountRepository = inject(BANK_ACCOUNT_REPOSITORY_TOKEN);
  private readonly notify = inject(NotifyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly banks = signal<BankDirectoryEntry[]>([]);
  readonly accounts = signal<BankAccount[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showForm = signal(false);
  readonly search = signal('');
  bankBin = '';
  accountNumber = '';
  accountName = '';
  readonly refundContext = this.route.snapshot.queryParamMap.get('reason') === 'refund';
  readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

  constructor() { this.load(); }

  get filteredBanks(): BankDirectoryEntry[] {
    const query = this.search().trim().toLowerCase();
    return query ? this.banks().filter(bank => `${bank.shortName} ${bank.name} ${bank.code}`.toLowerCase().includes(query)) : this.banks();
  }
  getBank(bankBin: string): BankDirectoryEntry | undefined { return this.banks().find(bank => bank.bin === bankBin); }
  load(): void {
    this.loading.set(true);
    forkJoin({ banks: this.repository.getBanks(), accounts: this.repository.getMyAccounts() })
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => { this.banks.set(result.banks); this.accounts.set(result.accounts); this.showForm.set(result.accounts.length === 0); },
        error: error => this.notify.error(error?.error?.message || 'Không thể tải thông tin ngân hàng.')
      });
  }
  submit(): void {
    const request: LinkBankAccountRequest = { bankBin: this.bankBin, accountNumber: this.accountNumber.replace(/\s/g, ''), accountName: this.accountName.trim() };
    if (!/^\d{6,19}$/.test(request.accountNumber) || !request.bankBin || !request.accountName) { this.notify.error('Vui lòng chọn ngân hàng và nhập đúng thông tin tài khoản.'); return; }
    this.saving.set(true);
    this.repository.link(request).pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: account => { this.accounts.update(accounts => [account, ...accounts]); this.resetForm(); this.notify.success(this.refundContext ? 'Đã liên kết. Khoản hoàn tự động sẽ được chuyển khi payOS xác minh tài khoản.' : 'Đã liên kết tài khoản. payOS sẽ xác minh ở giao dịch đầu tiên.'); },
      error: error => this.notify.error(error?.error?.message || 'Không thể liên kết tài khoản ngân hàng.')
    });
  }
  makeDefault(account: BankAccount): void {
    if (account.isDefault) return;
    this.repository.makeDefault(account.bankAccountId).subscribe({
      next: updated => this.accounts.update(accounts => accounts.map(item => ({ ...item, isDefault: item.bankAccountId === updated.bankAccountId }))),
      error: error => this.notify.error(error?.error?.message || 'Không thể đổi tài khoản mặc định.')
    });
  }
  disable(account: BankAccount): void {
    if (!window.confirm(`Ngừng sử dụng tài khoản ****${account.accountNumberLast4}?`)) return;
    this.repository.disable(account.bankAccountId).subscribe({
      next: () => { this.accounts.update(accounts => accounts.filter(item => item.bankAccountId !== account.bankAccountId)); this.notify.success('Đã ngừng sử dụng tài khoản ngân hàng.'); },
      error: error => this.notify.error(error?.error?.message || 'Không thể gỡ tài khoản ngân hàng.')
    });
  }
  continueFlow(): void { if (this.returnUrl) void this.router.navigateByUrl(this.returnUrl); }
  statusLabel(status: BankAccount['status']): string {
    return { PENDING_VERIFICATION: 'Chờ giao dịch xác minh', VERIFIED: 'Đã xác minh bởi payOS', REJECTED: 'Thông tin không hợp lệ', DISABLED: 'Đã ngừng sử dụng' }[status];
  }
  private resetForm(): void { this.bankBin = ''; this.accountNumber = ''; this.accountName = ''; this.search.set(''); this.showForm.set(false); }
}
