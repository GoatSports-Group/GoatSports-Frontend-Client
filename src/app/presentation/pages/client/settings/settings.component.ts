import { Component, inject } from '@angular/core';
import { finalize, switchMap } from 'rxjs/operators';
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
export class SettingsComponent {
  public authService = inject(AuthService);
  public notificationService = inject(NotificationService);
  private storageService = inject(StorageService);
  private userService = inject(UserService);
  private notifyService = inject(NotifyService);

  public activeTab: SettingsTabKey = 'player';
  public tabs = SETTINGS_TABS;
  public isUploadingAvatar = false;
  public localAvatarPreview: string | null = null;

  setActiveTab(key: SettingsTabKey): void {
    this.activeTab = key;
  }

  get fallbackAvatar(): string {
    if (this.localAvatarPreview) {
      return this.localAvatarPreview;
    }
    const user = this.authService.currentUser;
    if (user?.avatarUrl) {
      return user.avatarUrl;
    }
    return user?.fullName
      ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.fullName)}`
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80';
  }

  onAvatarImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const user = this.authService.currentUser;
    const fallback = user?.fullName
      ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.fullName)}`
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80';
    if (img.src !== fallback) {
      img.src = fallback;
    }
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const user = this.authService.currentUser;
    if (!user?.userId) {
      this.notifyService.error('Vui lòng đăng nhập để cập nhật ảnh đại diện');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.notifyService.error('Ảnh đại diện không được vượt quá 5MB');
      input.value = '';
      return;
    }

    // Immediately display preview locally so UI updates instantly across Header, Sidebar, etc.
    const previewUrl = URL.createObjectURL(file);
    this.localAvatarPreview = previewUrl;
    const previousUser = { ...user };
    this.authService.updateCurrentUser({ ...user, avatarUrl: previewUrl });

    this.isUploadingAvatar = true;
    this.storageService.uploadAvatar(file).pipe(
      switchMap(tempKey => this.userService.updateAvatar(user.userId, tempKey)),
      switchMap(() => this.authService.getCurrentUser()),
      finalize(() => {
        this.isUploadingAvatar = false;
        input.value = '';
      })
    ).subscribe({
      next: (refreshedUser) => {
        this.authService.updateCurrentUser(refreshedUser);
        this.notifyService.success('Cập nhật ảnh đại diện thành công!');
      },
      error: (err) => {
        this.localAvatarPreview = null;
        this.authService.updateCurrentUser(previousUser);
        console.error('Failed to update avatar:', err);
        this.notifyService.error(err?.error?.message || 'Không thể cập nhật ảnh đại diện, vui lòng thử lại');
      }
    });
  }
}
