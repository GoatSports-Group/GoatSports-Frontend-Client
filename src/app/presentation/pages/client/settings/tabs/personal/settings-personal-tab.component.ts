import { Component, Input, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { User, UpdateUserRequest } from '@application/dto/user/user.dto';
import { AuthService } from '@presentation/services/auth.service';
import { UserService } from '@presentation/services/user.service';
import { SelectOption } from '@shared/components/ui/select/select.component';
import { NotifyService } from '@shared/components/notify/notify.service';

@Component({
  selector: 'app-settings-personal-tab',
  templateUrl: './settings-personal-tab.component.html',
  styleUrls: ['./settings-personal-tab.component.scss'],
  standalone: false
})
export class SettingsPersonalTabComponent implements OnInit, OnChanges {
  @Input() user: User | null = null;

  public authService = inject(AuthService);
  private userService = inject(UserService);
  private notifyService = inject(NotifyService);

  public isModalOpen = false;
  public isSaving = false;
  public readonly genderOptions: SelectOption[] = [
    { value: 'MALE', label: 'Nam' },
    { value: 'FEMALE', label: 'Nữ' },
    { value: 'OTHER', label: 'Khác' }
  ];

  public formData = {
    fullName: '',
    username: '',
    phone: '',
    country: '',
    gender: ''
  };

  ngOnInit(): void {
    this.syncFormData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user']) {
      this.syncFormData();
    }
  }

  private syncFormData(): void {
    if (this.user) {
      this.formData = {
        fullName: this.user.fullName || '',
        username: this.user.username || '',
        phone: this.user.phone || '',
        country: this.user.country || '',
        gender: this.user.gender || ''
      };
    }
  }

  openEdit(): void {
    this.syncFormData();
    this.isModalOpen = true;
  }

  closeModal(): void {
    if (this.isSaving) return;
    this.isModalOpen = false;
  }

  onSave(): void {
    if (this.isSaving) return;

    if (!this.user?.userId) {
      this.notifyService.error('Không tìm thấy thông tin tài khoản. Vui lòng tải lại trang.');
      return;
    }

    const payload: UpdateUserRequest = {
      fullName: this.formData.fullName.trim(),
      username: this.formData.username.trim(),
      phone: this.normalizePhone(this.formData.phone),
      country: this.formData.country.trim(),
      gender: this.formData.gender
    };

    if (!payload.fullName) {
      this.notifyService.error('Vui lòng nhập họ và tên.');
      return;
    }

    if (!payload.username) {
      this.notifyService.error('Vui lòng nhập tên đăng nhập.');
      return;
    }

    if (payload.phone && !/^\+?\d{8,15}$/.test(payload.phone)) {
      this.notifyService.error('Số điện thoại chưa đúng định dạng. Vui lòng nhập từ 8 đến 15 chữ số.');
      return;
    }

    if (!payload.gender) {
      this.notifyService.error('Vui lòng chọn giới tính.');
      return;
    }

    this.isSaving = true;
    this.userService.updateUser(this.user.userId, payload).subscribe({
      next: (updatedUser) => {
        this.isSaving = false;
        this.authService.updateCurrentUser(updatedUser);
        this.notifyService.success('Đã cập nhật hồ sơ cá nhân.');
        this.closeModal();
      },
      error: (err) => {
        this.isSaving = false;
        const message = this.getErrorMessage(err);
        this.notifyService.error(message);
      }
    });
  }

  get isEmailVerified(): boolean {
    const status = (this.user?.status || '').toUpperCase();
    return status === 'ACTIVE' || status === 'HOẠT ĐỘNG';
  }

  formatGender(gender?: string): string {
    if (!gender) return 'Chưa cập nhật';
    const normalized = gender.toUpperCase();
    if (normalized === 'MALE' || normalized === 'NAM') return 'Nam';
    if (normalized === 'FEMALE' || normalized === 'NU' || normalized === 'NỮ') return 'Nữ';
    return 'Khác';
  }

  formatDate(dateString?: string): string {
    if (!dateString) return 'Mới tham gia';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'Chưa có thông tin';
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  private normalizePhone(phone: string): string {
    return phone.trim().replace(/[\s.()-]/g, '');
  }

  private getErrorMessage(error: unknown): string {
    const candidate = (error as { error?: { message?: unknown } })?.error?.message;
    if (typeof candidate === 'string' && candidate.toLowerCase().includes('tên đăng nhập')) {
      return 'Tên đăng nhập đã được sử dụng. Vui lòng chọn tên khác.';
    }
    return 'Không thể cập nhật hồ sơ. Vui lòng kiểm tra thông tin và thử lại.';
  }
}
