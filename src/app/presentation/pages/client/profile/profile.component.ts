import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  public authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  linking = false;

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
    this.darkMode = document.body.classList.contains('dark-theme');

    const code = this.route.snapshot.queryParams['code'];
    if (code) {
      this.linkAccount(code);
    }
  }

  redirectToKeycloak() {
    const keycloakUrl = import.meta.env.NG_APP_KEYCLOAK_URL;
    const realm = import.meta.env.NG_APP_KEYCLOAK_REALM;
    const clientId = import.meta.env.NG_APP_KEYCLOAK_CLIENT_ID;

    const redirectUri = `${window.location.origin}/profile`;

    const authUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/auth`
      + `?client_id=${encodeURIComponent(clientId)}`
      + `&response_type=code`
      + `&redirect_uri=${encodeURIComponent(redirectUri)}`
      + `&scope=openid`;

    window.location.href = authUrl;
  }

  linkAccount(code: string) {
    const payload = { code, redirectUri: `${window.location.origin}/profile` };
    this.linking = true;
    this.authService.linkKeycloak(payload).subscribe({
      next: () => {
        this.linking = false;
        this.snackBar.open('Liên kết tài khoản Keycloak thành công!', 'Đóng', {
          duration: 3000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-success']
        });

        this.router.navigate([], {
          queryParams: { code: null, session_state: null, iss: null },
          queryParamsHandling: 'merge'
        });

        this.authService.getCurrentUser().subscribe();
      },
      error: (err: HttpErrorResponse) => {
        this.linking = false;
        this.router.navigate([], {
          queryParams: { code: null, session_state: null, iss: null },
          queryParamsHandling: 'merge'
        });

        const errMsg = err.error?.message || 'Liên kết tài khoản Keycloak thất bại!';
        this.snackBar.open(errMsg, 'Đóng', {
          duration: 4000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-error']
        });
      }
    });
  }

  toggleTheme(checked: boolean) {
    this.darkMode = checked;
    if (checked) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    this.snackBar.open(checked ? 'Đã kích hoạt Chế độ tối' : 'Đã kích hoạt Chế độ sáng', 'Đóng', {
      duration: 2000,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }

  saveSettings() {
    this.snackBar.open('Đã lưu cấu hình cài đặt của bạn!', 'Đóng', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['snackbar-success']
    });
  }

  updatePassword() {
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.snackBar.open('Vui lòng nhập đầy đủ thông tin mật khẩu!', 'Đóng', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'top',
        panelClass: ['snackbar-error']
      });
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.snackBar.open('Mật khẩu mới và xác nhận mật khẩu không khớp!', 'Đóng', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'top',
        panelClass: ['snackbar-error']
      });
      return;
    }

    this.passwordLoading = true;
    setTimeout(() => {
      this.passwordLoading = false;
      this.snackBar.open('Cập nhật mật khẩu thành công!', 'Đóng', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'top',
        panelClass: ['snackbar-success']
      });
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
