import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@presentation/services/auth.service';
import { HttpErrorResponse } from '@angular/common/http';
import { NotifyService } from '@shared/components/notify/notify.service';

@Component({
    selector: 'app-profile',
    templateUrl: './profile.component.html',
    styleUrls: ['./profile.component.scss'],
    standalone: false
})
export class ProfileComponent implements OnInit {
  public authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notify = inject(NotifyService);

  darkMode = false;
  emailBooking = true;
  emailPromo = false;
  emailSecurity = true;
  language = 'vi';

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  passwordLoading = false;

  ngOnInit() {
    this.darkMode = document.body.classList.contains('dark') || document.body.classList.contains('dark-theme');
  }

  toggleTheme(checked: boolean) {
    this.darkMode = checked;
    if (checked) {
      document.body.classList.add('dark');
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark');
      document.body.classList.remove('dark-theme');
    }
    this.notify.info(checked ? 'Đã kích hoạt Chế độ tối.' : 'Đã kích hoạt Chế độ sáng.');
  }

  saveSettings() {
    this.notify.success('Đã lưu cấu hình cài đặt của bạn.');
  }

  updatePassword() {
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.notify.error('Vui lòng nhập đầy đủ thông tin mật khẩu.');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.notify.error('Mật khẩu mới và xác nhận mật khẩu không khớp.');
      return;
    }

    this.passwordLoading = true;
    setTimeout(() => {
      this.passwordLoading = false;
      this.notify.success('Cập nhật mật khẩu thành công.');
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
    }, 1200);
  }

  get fallbackAvatar(): string {
    const user = this.authService.currentUser;
    return user?.fullName
      ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.fullName)}`
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&q=80';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }
}
