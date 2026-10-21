import { Component, Input, OnInit, inject } from '@angular/core';
import { AiRepositoryPort } from '@application/ports/ai.repository.port';
import { USER_REPOSITORY_TOKEN, UserRepository } from '@application/ports/persistence/user.repository';
import { User, UpdatePasswordRequest, CreatePasswordRequest } from '@application/dto/user/user.dto';
import { AuthService } from '@presentation/services/auth.service';
import { UserService } from '@presentation/services/user.service';
import { CryptoService } from '@presentation/services/crypto.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { finalize, map, switchMap } from 'rxjs/operators';

/** Việc còn dang dở chặn xóa tài khoản: lời giải thích và chỗ để xử lý (mã do backend trả về). */
interface DeletionBlocker {
  icon: string;
  text: string;
  link?: string;
  queryParams?: Record<string, string>;
  linkLabel?: string;
}

const DELETION_BLOCKERS: Record<string, DeletionBlocker> = {
  OPEN_BOOKINGS: {
    icon: 'ticket', text: 'Bạn còn vé đặt sân chưa diễn ra hoặc đang chờ thanh toán.',
    link: '/booking/history', linkLabel: 'Xem vé'
  },
  OPEN_CANCELLATIONS: {
    icon: 'calendar-x', text: 'Bạn còn yêu cầu hủy sân đang xử lý hoặc tiền hoàn chưa nhận.',
    link: '/booking/history', linkLabel: 'Xem vé'
  },
  REFUND_IN_PROGRESS: {
    icon: 'wallet', text: 'Bạn còn khoản hoàn tiền chưa về tài khoản ngân hàng.',
    link: '/settings', queryParams: { tab: 'banking' }, linkLabel: 'Xem khoản hoàn'
  },
  CLUB_OWNER: {
    icon: 'users', text: 'Bạn đang là chủ câu lạc bộ. Hãy chuyển quyền chủ cho thành viên khác trước.',
    link: '/clubs/my', linkLabel: 'CLB của tôi'
  },
  TOURNAMENT_IN_PROGRESS: {
    icon: 'trophy', text: 'Bạn đang tham gia một giải đấu chưa kết thúc.',
    link: '/tournaments', queryParams: { tab: 'joined' }, linkLabel: 'Giải của tôi'
  },
  OWNS_VENUES: {
    icon: 'building-2', text: 'Tài khoản đang sở hữu cơ sở thể thao. Liên hệ hỗ trợ để đóng cơ sở trước.',
    link: '/policy/contact-support', linkLabel: 'Liên hệ hỗ trợ'
  },
  OWNER_APPLICATION_PENDING: {
    icon: 'building-2', text: 'Hồ sơ đăng ký chủ sân của bạn đang chờ duyệt.',
    link: '/policy/contact-support', linkLabel: 'Liên hệ hỗ trợ'
  },
  ADMIN_ACCOUNT: { icon: 'shield-alert', text: 'Tài khoản quản trị viên không thể tự xóa.' }
};

@Component({
  selector: 'app-settings-security-tab',
  templateUrl: './settings-security-tab.component.html',
  styleUrls: ['./settings-security-tab.component.scss'],
  standalone: false
})
export class SettingsSecurityTabComponent implements OnInit {
  @Input() user: User | null = null;

  public authService = inject(AuthService);
  private userService = inject(UserService);
  private cryptoService = inject(CryptoService);
  private notifyService = inject(NotifyService);
  private ai = inject(AiRepositoryPort);
  private users = inject<UserRepository>(USER_REPOSITORY_TOKEN);

  /** Xóa tài khoản: kiểm tra việc dang dở → giải thích → nhập mã email + gõ XÓA. */
  public deletionStep: 'closed' | 'checking' | 'blocked' | 'confirm' | 'code' = 'closed';
  public deletionBlockers: DeletionBlocker[] = [];
  public deletionCode = '';
  public deletionConfirmText = '';
  public deletionBusy = false;
  public deletionError = '';

  /** null: đang tải hoặc tải lỗi (personalizationFailed). */
  public personalization: boolean | null = null;
  public personalizationFailed = false;
  public personalizationSaving = false;

  public showPasswordModal = false;
  public isSaving = false;
  public isLoggingOut = false;

  public showCurrentPass = false;
  public showNewPass = false;
  public showConfirmPass = false;

  public form: UpdatePasswordRequest = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  ngOnInit(): void {
    this.ai.getPersonalization().subscribe({
      next: enabled => this.personalization = enabled,
      error: () => this.personalizationFailed = true
    });
  }

  togglePersonalization(enabled: boolean): void {
    const previous = this.personalization;
    this.personalization = enabled;
    this.personalizationSaving = true;
    this.ai.setPersonalization(enabled).pipe(finalize(() => this.personalizationSaving = false)).subscribe({
      next: saved => {
        this.personalization = saved;
        this.notifyService.success(saved ? 'Đã bật gợi ý theo hoạt động.' : 'Đã tắt và xóa lịch sử hoạt động dùng cho gợi ý.');
      },
      error: () => {
        this.personalization = previous;
        this.notifyService.error('Chưa lưu được cài đặt. Vui lòng thử lại.');
      }
    });
  }

  get hasPassword(): boolean {
    return this.user?.hasPassword === true;
  }

  get authenticationMethods(): string {
    const providers = new Set(this.user?.authProviders ?? []);
    if (this.hasPassword) providers.add('LOCAL');
    if (!providers.size) return 'Chưa có thông tin';

    return [...providers]
      .map(provider => {
        const normalized = provider.toUpperCase();
        if (normalized === 'LOCAL') return 'Tài khoản GOAT SPORTS';
        if (normalized === 'GOOGLE') return 'Google';
        return 'Phương thức khác';
      })
      .join(', ');
  }

  get roleLabel(): string {
    const role = (this.user?.role?.name || '').toUpperCase();
    if (role === 'ADMIN') return 'Quản trị viên';
    if (role === 'VENUE_OWNER' || role === 'OWNER') return 'Chủ cơ sở';
    if (role === 'PLAYER' || role === 'USER') return 'Người chơi';
    return role ? 'Vai trò khác' : 'Chưa có thông tin';
  }

  get statusLabel(): string {
    const status = (this.user?.status || '').toUpperCase();
    if (status === 'ACTIVE' || status === 'HOẠT ĐỘNG') return 'Đang hoạt động';
    if (status === 'PENDING' || status === 'CHỜ XÁC THỰC') return 'Chờ xác thực';
    if (status === 'BLOCKED' || status === 'ĐÃ KHÓA') return 'Đã khóa';
    if (status === 'INACTIVE' || status === 'KHÔNG HOẠT ĐỘNG') return 'Không hoạt động';
    return 'Chưa có thông tin';
  }

  get isActive(): boolean {
    return this.statusLabel === 'Đang hoạt động';
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
    if (this.isSaving) return;
    this.showPasswordModal = false;
  }

  onSavePassword(): void {
    if (this.isSaving) return;

    if (this.hasPassword && !this.form.currentPassword) {
      this.notifyService.error('Vui lòng nhập mật khẩu hiện tại');
      return;
    }

    if (!this.form.newPassword) {
      this.notifyService.error('Vui lòng nhập mật khẩu mới.');
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(this.form.newPassword)) {
      this.notifyService.error('Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.');
      return;
    }

    if (!this.form.confirmPassword) {
      this.notifyService.error('Vui lòng xác nhận mật khẩu mới.');
      return;
    }

    if (this.form.newPassword !== this.form.confirmPassword) {
      this.notifyService.error('Mật khẩu mới và xác nhận không khớp.');
      return;
    }

    if (this.hasPassword && this.form.currentPassword === this.form.newPassword) {
      this.notifyService.error('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
      return;
    }

    this.isSaving = true;
    this.cryptoService.getPublicKey().pipe(
      map(publicKey => ({
        currentPassword: this.hasPassword
          ? this.cryptoService.encrypt(this.form.currentPassword, publicKey)
          : '',
        newPassword: this.cryptoService.encrypt(this.form.newPassword, publicKey),
        confirmPassword: this.cryptoService.encrypt(this.form.confirmPassword, publicKey)
      })),
      switchMap(encrypted => {
        if (this.hasPassword) {
          const payload: UpdatePasswordRequest = encrypted;
          return this.userService.updatePassword(payload);
        }

        const payload: CreatePasswordRequest = {
          newPassword: encrypted.newPassword,
          confirmPassword: encrypted.confirmPassword
        };
        return this.userService.createPassword(payload);
      }),
      finalize(() => this.isSaving = false)
    ).subscribe({
      next: () => {
        const createdPassword = !this.hasPassword;
        if (createdPassword && this.user) {
          this.authService.updateCurrentUser({ ...this.user, hasPassword: true });
        }
        this.notifyService.success(createdPassword ? 'Đã thiết lập mật khẩu.' : 'Đã đổi mật khẩu.');
        this.showPasswordModal = false;
      },
      error: err => this.notifyService.error(this.getPasswordErrorMessage(err))
    });
  }

  openDeletion(): void {
    if (this.deletionStep !== 'closed') return;
    this.deletionStep = 'checking';
    this.deletionError = '';
    this.deletionCode = '';
    this.deletionConfirmText = '';
    this.users.getDeletionBlockers().subscribe({
      next: codes => {
        this.deletionBlockers = codes.map(code => DELETION_BLOCKERS[code]
          ?? { icon: 'circle-alert', text: 'Tài khoản còn việc chưa xử lý xong. Vui lòng liên hệ hỗ trợ.' });
        this.deletionStep = codes.length ? 'blocked' : 'confirm';
      },
      error: err => {
        this.deletionStep = 'closed';
        this.notifyService.error(this.serverMessage(err, 'Chưa kiểm tra được tài khoản. Vui lòng thử lại.'));
      }
    });
  }

  closeDeletion(): void {
    if (this.deletionBusy) return;
    this.deletionStep = 'closed';
  }

  sendDeletionCode(): void {
    if (this.deletionBusy) return;
    this.deletionBusy = true;
    this.deletionError = '';
    this.users.sendDeletionCode().pipe(finalize(() => this.deletionBusy = false)).subscribe({
      next: () => this.deletionStep = 'code',
      error: err => this.deletionError = this.serverMessage(err, 'Chưa gửi được mã. Vui lòng thử lại.')
    });
  }

  get canConfirmDeletion(): boolean {
    return /^\d{6}$/.test(this.deletionCode.trim())
      && this.deletionConfirmText.normalize('NFC').trim().toUpperCase() === 'XÓA';
  }

  confirmDeletion(): void {
    if (!this.canConfirmDeletion || this.deletionBusy) return;
    this.deletionBusy = true;
    this.deletionError = '';
    this.users.requestDeletion(this.deletionCode.trim()).pipe(finalize(() => this.deletionBusy = false)).subscribe({
      next: purgeAt => {
        this.deletionStep = 'closed';
        const date = new Date(purgeAt).toLocaleDateString('vi-VN');
        this.notifyService.success(
          `Tài khoản sẽ bị xóa vĩnh viễn vào ngày ${date}. Đăng nhập lại trước ngày đó nếu bạn đổi ý.`,
          'Đã nhận yêu cầu xóa tài khoản'
        );
        this.authService.logout().subscribe({ error: () => undefined });
      },
      error: err => this.deletionError = this.serverMessage(err, 'Chưa xóa được tài khoản. Vui lòng thử lại.')
    });
  }

  private serverMessage(error: unknown, fallback: string): string {
    const message = (error as { error?: { message?: unknown } })?.error?.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }

  logoutCurrentSession(): void {
    if (this.isLoggingOut) return;
    this.isLoggingOut = true;
    this.authService.logout().pipe(
      finalize(() => this.isLoggingOut = false)
    ).subscribe({
      error: () => undefined
    });
  }

  private getPasswordErrorMessage(error: unknown): string {
    const candidate = (error as { error?: { message?: unknown } })?.error?.message;
    if (typeof candidate === 'string') {
      const normalized = candidate.toLowerCase();
      if (normalized.includes('hiện tại không chính xác')) {
        return 'Mật khẩu hiện tại không chính xác.';
      }
      if (normalized.includes('đã có mật khẩu')) {
        return 'Tài khoản đã có mật khẩu. Vui lòng tải lại trang rồi chọn đổi mật khẩu.';
      }
    }
    return 'Không thể cập nhật mật khẩu. Vui lòng kiểm tra thông tin và thử lại.';
  }
}
