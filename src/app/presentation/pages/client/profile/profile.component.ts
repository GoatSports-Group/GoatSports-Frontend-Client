import { Component, inject } from '@angular/core';
import { AuthService } from '@presentation/services/auth.service';
import { PROFILE_TABS, ProfileTabItem, ProfileTabKey } from './profile.models';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: false
})
export class ProfileComponent {
  public authService = inject(AuthService);

  readonly tabs: ProfileTabItem[] = PROFILE_TABS;
  activeTab: ProfileTabKey = 'info';

  setActiveTab(tabKey: ProfileTabKey): void {
    this.activeTab = tabKey;
  }
}
