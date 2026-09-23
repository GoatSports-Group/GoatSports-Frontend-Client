export type SettingsTabKey = 'personal' | 'sports' | 'banking' | 'security';

export interface SettingsTabItem {
  key: SettingsTabKey;
  label: string;
  icon: string;
}

export const SETTINGS_TABS: SettingsTabItem[] = [
  { key: 'personal', label: 'Hồ sơ cá nhân', icon: 'user' },
  { key: 'sports', label: 'Hồ sơ thể thao', icon: 'activity' },
  { key: 'banking', label: 'Ngân hàng & hoàn tiền', icon: 'credit-card' },
  { key: 'security', label: 'Đăng nhập & bảo mật', icon: 'shield-check' }
];
