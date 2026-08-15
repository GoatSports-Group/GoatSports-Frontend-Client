import { Component, Input, inject } from '@angular/core';
import { User } from '@application/dto/user/user.dto';
import { NotifyService } from '@shared/components/notify/notify.service';
import { SecurityPasswordForm } from '../../settings.models';

@Component({
  selector: 'app-settings-security-tab',
  templateUrl: './settings-security-tab.component.html',
  styleUrls: ['./settings-security-tab.component.scss'],
  standalone: false
})
export class SettingsSecurityTabComponent {
  @Input() user: User | null = null;
  private notifyService = inject(NotifyService);

  public showPasswordModal = false;
  public isLoading = false;

  public form: SecurityPasswordForm = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  onUpdatePassword(): void {
    this.notifyService.info('Bảo mật', 'Tính năng cập nhật mật khẩu đang được tối ưu hóa');
  }

  onAction(label: string): void {
    this.notifyService.info('Cài đặt bảo mật', `Yêu cầu xử lý: ${label}`);
  }
}
