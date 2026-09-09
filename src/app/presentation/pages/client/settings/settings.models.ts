export type SettingsTabKey = 'personal' | 'sports' | 'banking' | 'security';

export interface SettingsTabItem {
  key: SettingsTabKey;
  label: string;
}

export const SETTINGS_TABS: SettingsTabItem[] = [
  { key: 'personal', label: 'Hồ sơ cá nhân' },
  { key: 'sports', label: 'Hồ sơ thể thao' },
  { key: 'banking', label: 'Ngân hàng & hoàn tiền' },
  { key: 'security', label: 'Đăng nhập và bảo mật' }
];
