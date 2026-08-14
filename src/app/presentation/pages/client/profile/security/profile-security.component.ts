import { Component, Input, inject } from '@angular/core';
import { NotifyService } from '@shared/components/notify/notify.service';
import { User } from '@application/dto/user/user.dto';
import { PasswordFormState } from '../profile.models';

@Component({
  selector: 'app-profile-security',
  templateUrl: './profile-security.component.html',
  styleUrls: ['./profile-security.component.scss'],
  standalone: false
})
export class ProfileSecurityComponent {
  @Input() user: User | null = null;
  private notify = inject(NotifyService);

  form: PasswordFormState = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  isLoading = false;

  updatePassword() {
    if (!this.form.currentPassword || !this.form.newPassword || !this.form.confirmPassword) {
      this.notify.error('Vui lòng nhập đầy đủ các trường thông tin mật khẩu.');
      return;
    }

    if (this.form.newPassword.length < 6) {
      this.notify.error('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }

    if (this.form.newPassword !== this.form.confirmPassword) {
      this.notify.error('Mật khẩu mới và xác nhận mật khẩu không trùng khớp.');
      return;
    }

    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.notify.success('Cập nhật mật khẩu bảo vệ tài khoản thành công.');
      this.form = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      };
    }, 1000);
  }
}
