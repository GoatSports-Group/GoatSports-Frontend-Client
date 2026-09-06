export type SettingsTabKey = 'personal' | 'security';

export interface SettingsTabItem {
  key: SettingsTabKey;
  label: string;
}

export const SETTINGS_TABS: SettingsTabItem[] = [
  { key: 'personal', label: 'Hồ sơ cá nhân' },
  { key: 'security', label: 'Đăng nhập và bảo mật' }
];
