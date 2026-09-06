import { Component, Input, inject } from '@angular/core';
import { User, UpdatePasswordRequest, CreatePasswordRequest } from '@application/dto/user/user.dto';
import { AuthService } from '@presentation/services/auth.service';
import { UserService } from '@presentation/services/user.service';
import { CryptoService } from '@presentation/services/crypto.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { finalize, map, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-settings-security-tab',
  templateUrl: './settings-security-tab.component.html',
  styleUrls: ['./settings-security-tab.component.scss'],
  standalone: false
})
export class SettingsSecurityTabComponent {
  @Input() user: User | null = null;

  public authService = inject(AuthService);
  private userService = inject(UserService);
  private cryptoService = inject(CryptoService);
  private notifyService = inject(NotifyService);

  public showPasswordModal = false;
  public isSaving = false;
  public isLoggingOut = false;

  public showCurrentPass = false;
  public showNewPass = false;
  public showConfirmPass = false;

  public form: UpdatePasswordRequest = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  get hasPassword(): boolean {
    return this.user?.hasPassword === true;
  }

  get authenticationMethods(): string {
    const providers = new Set(this.user?.authProviders ?? []);
    if (this.hasPassword) providers.add('LOCAL');
    if (!providers.size) return 'Chưa có thông tin';

    return [...providers]
      .map(provider => {
        const normalized = provider.toUpperCase();
        if (normalized === 'LOCAL') return 'Tài khoản GOAT SPORTS';
        if (normalized === 'GOOGLE') return 'Google';
        return 'Phương thức khác';
      })
      .join(', ');
  }

  get roleLabel(): string {
    const role = (this.user?.role?.name || '').toUpperCase();
    if (role === 'ADMIN') return 'Quản trị viên';
    if (role === 'VENUE_OWNER' || role === 'OWNER') return 'Chủ cơ sở';
    if (role === 'PLAYER' || role === 'USER') return 'Người chơi';
    return role ? 'Vai trò khác' : 'Chưa có thông tin';
  }

  get statusLabel(): string {
    const status = (this.user?.status || '').toUpperCase();
    if (status === 'ACTIVE' || status === 'HOẠT ĐỘNG') return 'Đang hoạt động';
    if (status === 'PENDING' || status === 'CHỜ XÁC THỰC') return 'Chờ xác thực';
    if (status === 'BLOCKED' || status === 'ĐÃ KHÓA') return 'Đã khóa';
    if (status === 'INACTIVE' || status === 'KHÔNG HOẠT ĐỘNG') return 'Không hoạt động';
    return 'Chưa có thông tin';
  }

  get isActive(): boolean {
    return this.statusLabel === 'Đang hoạt động';
  }

  openPasswordModal(): void {
    this.form = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    };
    this.showCurrentPass = false;
    this.showNewPass = false;
    this.showConfirmPass = false;
    this.showPasswordModal = true;
  }

  closePasswordModal(): void {
    if (this.isSaving) return;
    this.showPasswordModal = false;
  }

  onSavePassword(): void {
    if (this.isSaving) return;

    if (this.hasPassword && !this.form.currentPassword) {
      this.notifyService.error('Vui lòng nhập mật khẩu hiện tại');
      return;
    }

    if (!this.form.newPassword) {
      this.notifyService.error('Vui lòng nhập mật khẩu mới.');
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(this.form.newPassword)) {
      this.notifyService.error('Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.');
      return;
    }

    if (!this.form.confirmPassword) {
      this.notifyService.error('Vui lòng xác nhận mật khẩu mới.');
      return;
    }

    if (this.form.newPassword !== this.form.confirmPassword) {
      this.notifyService.error('Mật khẩu mới và xác nhận không khớp.');
      return;
    }

    if (this.hasPassword && this.form.currentPassword === this.form.newPassword) {
      this.notifyService.error('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
      return;
    }

    this.isSaving = true;
    this.cryptoService.getPublicKey().pipe(
      map(publicKey => ({
        currentPassword: this.hasPassword
          ? this.cryptoService.encrypt(this.form.currentPassword, publicKey)
          : '',
        newPassword: this.cryptoService.encrypt(this.form.newPassword, publicKey),
        confirmPassword: this.cryptoService.encrypt(this.form.confirmPassword, publicKey)
      })),
      switchMap(encrypted => {
        if (this.hasPassword) {
          const payload: UpdatePasswordRequest = encrypted;
          return this.userService.updatePassword(payload);
        }

        const payload: CreatePasswordRequest = {
          newPassword: encrypted.newPassword,
          confirmPassword: encrypted.confirmPassword
        };
        return this.userService.createPassword(payload);
      }),
      finalize(() => this.isSaving = false)
    ).subscribe({
      next: () => {
        const createdPassword = !this.hasPassword;
        if (createdPassword && this.user) {
          this.authService.updateCurrentUser({ ...this.user, hasPassword: true });
        }
        this.notifyService.success(createdPassword ? 'Đã thiết lập mật khẩu.' : 'Đã đổi mật khẩu.');
        this.showPasswordModal = false;
      },
      error: err => this.notifyService.error(this.getPasswordErrorMessage(err))
    });
  }

  logoutCurrentSession(): void {
    if (this.isLoggingOut) return;
    this.isLoggingOut = true;
    this.authService.logout().pipe(
      finalize(() => this.isLoggingOut = false)
    ).subscribe({
      error: () => undefined
    });
  }

  private getPasswordErrorMessage(error: unknown): string {
    const candidate = (error as { error?: { message?: unknown } })?.error?.message;
    if (typeof candidate === 'string') {
      const normalized = candidate.toLowerCase();
      if (normalized.includes('hiện tại không chính xác')) {
        return 'Mật khẩu hiện tại không chính xác.';
      }
      if (normalized.includes('đã có mật khẩu')) {
        return 'Tài khoản đã có mật khẩu. Vui lòng tải lại trang rồi chọn đổi mật khẩu.';
      }
    }
    return 'Không thể cập nhật mật khẩu. Vui lòng kiểm tra thông tin và thử lại.';
  }
}
