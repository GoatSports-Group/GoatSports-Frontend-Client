import { Component, Input, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { User } from '@application/dto/user/user.dto';
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
  public activeEditingField = '';

  public genderOptions: SelectOption[] = [
    { value: 'MALE', label: 'Nam' },
    { value: 'FEMALE', label: 'Nữ' },
    { value: 'OTHER', label: 'Khác' }
  ];

  public countryOptions: SelectOption[] = [
    { value: 'Việt Nam', label: 'Việt Nam' },
    { value: 'Hàn Quốc', label: 'Hàn Quốc' },
    { value: 'Nhật Bản', label: 'Nhật Bản' },
    { value: 'Hoa Kỳ', label: 'Hoa Kỳ' },
    { value: 'Singapore', label: 'Singapore' },
    { value: 'Thái Lan', label: 'Thái Lan' },
    { value: 'Malaysia', label: 'Malaysia' },
    { value: 'Úc', label: 'Úc' },
    { value: 'Anh', label: 'Anh' },
    { value: 'Pháp', label: 'Pháp' },
    { value: 'Đức', label: 'Đức' },
    { value: 'Canada', label: 'Canada' },
    { value: 'Khác', label: 'Khác' }
  ];

  public formData = {
    fullName: '',
    username: '',
    phone: '',
    country: 'Việt Nam',
    gender: 'MALE'
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
        country: this.user.country || 'Việt Nam',
        gender: this.user.gender || 'MALE'
      };
    }
  }

  openEdit(field: string = ''): void {
    this.activeEditingField = field;
    this.syncFormData();
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  onSave(): void {
    if (!this.user?.userId) {
      this.notifyService.error('Không tìm thấy thông tin tài khoản');
      return;
    }

    if (!this.formData.fullName.trim()) {
      this.notifyService.error('Vui lòng nhập họ và tên');
      return;
    }

    this.isSaving = true;
    const payload: Partial<User> = {
      fullName: this.formData.fullName.trim(),
      username: this.formData.username.trim(),
      phone: this.formData.phone.trim(),
      country: this.formData.country.trim(),
      gender: this.formData.gender
    };

    this.userService.updateUser(this.user.userId, payload).subscribe({
      next: (updatedUser) => {
        this.isSaving = false;
        this.user = { ...this.user, ...updatedUser };
        this.authService.updateCurrentUser(this.user as User);
        this.notifyService.success('Cập nhật thông tin cá nhân thành công!');
        this.closeModal();
      },
      error: (err) => {
        this.isSaving = false;
        console.error('Failed to update user profile:', err);
        this.notifyService.error(err?.error?.message || 'Cập nhật thông tin thất bại, vui lòng thử lại');
      }
    });
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
}
