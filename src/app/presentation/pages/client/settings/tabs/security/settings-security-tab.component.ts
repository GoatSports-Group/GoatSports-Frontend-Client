import { Component, Input, inject } from '@angular/core';
import { User, UpdatePasswordRequest } from '@application/dto/user/user.dto';
import { UserService } from '@presentation/services/user.service';
import { NotifyService } from '@shared/components/notify/notify.service';

@Component({
  selector: 'app-settings-security-tab',
  templateUrl: './settings-security-tab.component.html',
  styleUrls: ['./settings-security-tab.component.scss'],
  standalone: false
})
export class SettingsSecurityTabComponent {
  @Input() user: User | null = null;

  private userService = inject(UserService);
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
    this.userService.updatePassword(this.form).subscribe({
      next: () => {
        this.isSaving = false;
        this.notifyService.success('Đổi mật khẩu thành công!');
        this.closePasswordModal();
      },
      error: (err) => {
        this.isSaving = false;
        console.error('Update password failed:', err);
        this.notifyService.error(err?.error?.message || 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu hiện tại');
      }
    });
  }

  onAction(label: string): void {
    this.notifyService.info('Cài đặt bảo mật', `Yêu cầu xử lý: ${label}`);
  }
}
