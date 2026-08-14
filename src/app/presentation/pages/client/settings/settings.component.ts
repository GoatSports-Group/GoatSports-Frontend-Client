import { Component, inject } from '@angular/core';
import { AuthService } from '@presentation/services/auth.service';
import { SETTINGS_TABS, SettingsTabKey } from './settings.models';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: false
})
export class SettingsComponent {
  public authService = inject(AuthService);
  public activeTab: SettingsTabKey = 'player';
  public tabs = SETTINGS_TABS;

  setActiveTab(key: SettingsTabKey): void {
    this.activeTab = key;
  }

  get fallbackAvatar(): string {
    const user = this.authService.currentUser;
    return user?.fullName
      ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.fullName)}`
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80';
  }
}
