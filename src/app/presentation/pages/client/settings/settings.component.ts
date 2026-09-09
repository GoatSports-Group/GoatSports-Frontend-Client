import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, switchMap, takeUntil, tap } from 'rxjs/operators';
import { User } from '@application/dto/user/user.dto';
import { AuthService } from '@presentation/services/auth.service';
import { NotificationService } from '@presentation/services/notification.service';
import { StorageService } from '@presentation/services/storage.service';
import { UserService } from '@presentation/services/user.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { SETTINGS_TABS, SettingsTabKey } from './settings.models';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: false
})
export class SettingsComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  public notificationService = inject(NotificationService);
  private storageService = inject(StorageService);
  private userService = inject(UserService);
  private notifyService = inject(NotifyService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private readonly destroy$ = new Subject<void>();

  public activeTab: SettingsTabKey = 'personal';
  public readonly tabs = SETTINGS_TABS;
  public user: User | null = null;
  public isLoadingProfile = true;
  public profileLoadFailed = false;
  public isUploadingAvatar = false;
  public localAvatarPreview: string | null = null;
  public avatarLoadFailed = false;

  ngOnInit(): void {
    const requestedTab = this.route.snapshot.queryParamMap.get('tab') as SettingsTabKey | null;
    if (requestedTab && this.tabs.some(tab => tab.key === requestedTab)) this.activeTab = requestedTab;
    this.user = this.authService.currentUser;
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.user = user;
        this.avatarLoadFailed = false;
      });

    this.loadProfile();
  }

  ngOnDestroy(): void {
    this.revokeAvatarPreview();
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProfile(): void {
    const userId = this.authService.currentUser?.userId;
    if (!userId) {
      this.isLoadingProfile = false;
      this.profileLoadFailed = true;
      return;
    }

    this.isLoadingProfile = true;
    this.profileLoadFailed = false;
    this.userService.getUserById(userId).pipe(
      finalize(() => this.isLoadingProfile = false)
    ).subscribe({
      next: user => this.authService.updateCurrentUser(user),
      error: () => this.profileLoadFailed = true
    });
  }

  setActiveTab(key: SettingsTabKey): void {
    this.activeTab = key;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: key },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  get avatarUrl(): string | null {
    if (this.avatarLoadFailed) return null;
    return this.localAvatarPreview || this.user?.avatarUrl || null;
  }

  get userInitials(): string {
    const source = this.user?.fullName || this.user?.username || this.user?.email || 'GS';
    return source
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map(part => part.charAt(0).toUpperCase())
      .join('') || 'GS';
  }

  onAvatarImgError(): void {
    this.avatarLoadFailed = true;
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const user = this.user;
    if (!user?.userId) {
      this.notifyService.error('Không tìm thấy thông tin tài khoản. Vui lòng tải lại trang.');
      input.value = '';
      return;
    }

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedTypes.has(file.type)) {
      this.notifyService.error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
      input.value = '';
      return;
    }

    if (file.size === 0) {
      this.notifyService.error('Tệp ảnh đang trống. Vui lòng chọn ảnh khác.');
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.notifyService.error('Ảnh đại diện không được vượt quá 5 MB.');
      input.value = '';
      return;
    }

    this.revokeAvatarPreview();
    const previewUrl = URL.createObjectURL(file);
    this.localAvatarPreview = previewUrl;
    this.avatarLoadFailed = false;

    let avatarPersisted = false;
    this.isUploadingAvatar = true;
    this.storageService.uploadAvatar(file).pipe(
      switchMap(tempKey => this.userService.updateAvatar(user.userId, tempKey)),
      tap(() => avatarPersisted = true),
      switchMap(() => this.userService.getUserById(user.userId)),
      finalize(() => {
        this.isUploadingAvatar = false;
        input.value = '';
      })
    ).subscribe({
      next: (refreshedUser) => {
        this.revokeAvatarPreview();
        this.authService.updateCurrentUser(refreshedUser);
        this.notifyService.success('Đã cập nhật ảnh đại diện.');
      },
      error: () => {
        if (avatarPersisted) {
          this.notifyService.warning('Ảnh đã được lưu nhưng chưa thể tải lại. Vui lòng làm mới trang.');
          return;
        }

        this.revokeAvatarPreview();
        this.notifyService.error('Không thể cập nhật ảnh đại diện. Vui lòng thử lại.');
      }
    });
  }

  private revokeAvatarPreview(): void {
    if (this.localAvatarPreview) {
      URL.revokeObjectURL(this.localAvatarPreview);
      this.localAvatarPreview = null;
    }
  }
}
