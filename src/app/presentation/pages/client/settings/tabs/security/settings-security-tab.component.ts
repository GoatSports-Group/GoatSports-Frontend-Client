import { Component, Input, inject } from '@angular/core';
import { User, UpdatePasswordRequest, CreatePasswordRequest } from '@application/dto/user/user.dto';
import { AuthService } from '@presentation/services/auth.service';
import { UserService } from '@presentation/services/user.service';
import { CryptoService } from '@presentation/services/crypto.service';
import { NotifyService } from '@shared/components/notify/notify.service';

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

  public showCurrentPass = false;
  public showNewPass = false;
  public showConfirmPass = false;

  public form: UpdatePasswordRequest = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  get hasPassword(): boolean {
    if (this.user?.hasPassword !== undefined) {
      return this.user.hasPassword;
    }
    return true;
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
    this.showPasswordModal = false;
  }

  onSavePassword(): void {
    if (this.hasPassword) {
      this.handleUpdatePassword();
    } else {
      this.handleCreatePassword();
    }
  }

  private handleCreatePassword(): void {
    if (!this.form.newPassword) {
      this.notifyService.error('Vui lòng nhập mật khẩu mới');
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(this.form.newPassword)) {
      this.notifyService.error('Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt');
      return;
    }

    if (!this.form.confirmPassword) {
      this.notifyService.error('Vui lòng xác nhận mật khẩu');
      return;
    }

    if (this.form.newPassword !== this.form.confirmPassword) {
      this.notifyService.error('Mật khẩu mới và xác nhận mật khẩu không khớp');
      return;
    }

    this.isSaving = true;

    this.cryptoService.getPublicKey().subscribe({
      next: (publicKey) => {
        const encryptedNewPassword = this.cryptoService.encrypt(this.form.newPassword, publicKey);
        const encryptedConfirmPassword = this.cryptoService.encrypt(this.form.confirmPassword, publicKey);

        const payload: CreatePasswordRequest = {
          newPassword: encryptedNewPassword,
          confirmPassword: encryptedConfirmPassword
        };

        this.userService.createPassword(payload).subscribe({
          next: () => {
            this.isSaving = false;
            if (this.user) {
              this.user = { ...this.user, hasPassword: true };
              this.authService.updateCurrentUser(this.user);
            }
            this.notifyService.success('Tạo mật khẩu cho tài khoản thành công!');
            this.closePasswordModal();
          },
          error: (err) => {
            this.isSaving = false;
            console.error('Create password failed:', err);
            this.notifyService.error(err?.error?.message || 'Tạo mật khẩu thất bại. Vui lòng thử lại');
          }
        });
      },
      error: (err) => {
        this.isSaving = false;
        console.error('Failed to get public key:', err);
        this.notifyService.error('Không thể thiết lập kết nối bảo mật để mã hóa mật khẩu');
      }
    });
  }

  private handleUpdatePassword(): void {
    if (!this.form.currentPassword) {
      this.notifyService.error('Vui lòng nhập mật khẩu hiện tại');
      return;
    }

    if (!this.form.newPassword) {
      this.notifyService.error('Vui lòng nhập mật khẩu mới');
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(this.form.newPassword)) {
      this.notifyService.error('Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt');
      return;
    }

    if (!this.form.confirmPassword) {
      this.notifyService.error('Vui lòng xác nhận mật khẩu mới');
      return;
    }

    if (this.form.newPassword !== this.form.confirmPassword) {
      this.notifyService.error('Mật khẩu mới và xác nhận mật khẩu không khớp');
      return;
    }

    if (this.form.currentPassword === this.form.newPassword) {
      this.notifyService.error('Mật khẩu mới không được trùng với mật khẩu hiện tại');
      return;
    }

    this.isSaving = true;

    this.cryptoService.getPublicKey().subscribe({
      next: (publicKey) => {
        const encryptedCurrent = this.cryptoService.encrypt(this.form.currentPassword, publicKey);
        const encryptedNew = this.cryptoService.encrypt(this.form.newPassword, publicKey);
        const encryptedConfirm = this.cryptoService.encrypt(this.form.confirmPassword, publicKey);

        const payload: UpdatePasswordRequest = {
          currentPassword: encryptedCurrent,
          newPassword: encryptedNew,
          confirmPassword: encryptedConfirm
        };

        this.userService.updatePassword(payload).subscribe({
          next: () => {
            this.isSaving = false;
            this.notifyService.success('Đổi mật khẩu thành công!');
            this.closePasswordModal();
          },
          error: (err) => {
            this.isSaving = false;
            console.error('Update password failed:', err);
            const errMsg = err?.error?.message || '';
            if (errMsg.includes('mạng xã hội')) {
              if (this.user) {
                this.user = { ...this.user, hasPassword: false };
                this.authService.updateCurrentUser(this.user);
              }
              this.notifyService.info('Thiết lập mật khẩu', 'Tài khoản mạng xã hội chưa có mật khẩu, vui lòng thiết lập mật khẩu');
            } else {
              this.notifyService.error(errMsg || 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu hiện tại');
            }
          }
        });
      },
      error: (err) => {
        this.isSaving = false;
        console.error('Failed to get public key:', err);
        this.notifyService.error('Không thể thiết lập kết nối bảo mật để mã hóa mật khẩu');
      }
    });
  }

  onAction(label: string): void {
    this.notifyService.info('Cài đặt bảo mật', `Yêu cầu xử lý: ${label}`);
  }
}
