import { Component, OnInit, inject } from '@angular/core';
import { NotifyService } from '@shared/components/notify/notify.service';
import { ProfileSettingsForm } from '../profile.models';

@Component({
  selector: 'app-profile-settings',
  templateUrl: './profile-settings.component.html',
  styleUrls: ['./profile-settings.component.scss'],
  standalone: false
})
export class ProfileSettingsComponent implements OnInit {
  private notify = inject(NotifyService);

  form: ProfileSettingsForm = {
    darkMode: false,
    emailBooking: true,
    emailPromo: false,
    emailSecurity: true,
    language: 'vi'
  };

  isSaving = false;

  ngOnInit() {
    this.form.darkMode = document.body.classList.contains('dark') || document.body.classList.contains('dark-theme');
  }

  toggleTheme(checked: boolean) {
    this.form.darkMode = checked;
    if (checked) {
      document.body.classList.add('dark');
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark');
      document.body.classList.remove('dark-theme');
    }
    this.notify.info(checked ? 'Đã kích hoạt Chế độ tối (Dark Mode).' : 'Đã kích hoạt Chế độ sáng.');
  }

  saveSettings() {
    this.isSaving = true;
    setTimeout(() => {
      this.isSaving = false;
      this.notify.success('Cấu hình cài đặt đã được lưu thành công.');
    }, 600);
  }
}
