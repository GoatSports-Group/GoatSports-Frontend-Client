import { Component, Input, inject } from '@angular/core';
import { User } from '@application/dto/user/user.dto';
import { NotifyService } from '@shared/components/notify/notify.service';
import { PersonalInfoForm } from '../settings.models';

@Component({
  selector: 'app-settings-personal-tab',
  templateUrl: './settings-personal-tab.component.html',
  styleUrls: ['./settings-personal-tab.component.scss'],
  standalone: false
})
export class SettingsPersonalTabComponent {
  @Input() user: User | null = null;
  private notifyService = inject(NotifyService);

  public form: PersonalInfoForm = {
    fullName: '',
    displayName: '',
    email: '',
    phone: 'N/A',
    gender: 'Nam',
    dateOfBirth: 'N/A',
    language: 'Tiếng Việt (Mặc định)',
    darkMode: false
  };

  formatDate(dateString?: string): string {
    if (!dateString) return 'Mới tham gia';
    try {
      return new Date(dateString).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  }

  onEdit(field: string): void {
    this.notifyService.info('Tính năng đang hoàn thiện', `Đang chuẩn bị form cập nhật ${field}`);
  }
}
