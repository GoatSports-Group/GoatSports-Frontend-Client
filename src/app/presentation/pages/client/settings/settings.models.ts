export type SettingsTabKey = 'personal' | 'sports' | 'security';

export interface SettingsTabItem {
  key: SettingsTabKey;
  label: string;
}

export const SETTINGS_TABS: SettingsTabItem[] = [
  { key: 'personal', label: 'Hồ sơ cá nhân' },
  { key: 'sports', label: 'Hồ sơ thể thao' },
  { key: 'security', label: 'Đăng nhập và bảo mật' }
];
