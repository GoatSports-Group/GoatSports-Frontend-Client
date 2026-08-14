export type SettingsTabKey = 'player' | 'personal' | 'security';

export interface SettingsTabItem {
  key: SettingsTabKey;
  label: string;
}

export const SETTINGS_TABS: SettingsTabItem[] = [
  { key: 'player', label: 'Hồ sơ người chơi' },
  { key: 'personal', label: 'Thông tin cá nhân' },
  { key: 'security', label: 'Đăng nhập & Bảo mật' }
];

export interface PlayerProfileForm {
  expertise: string;
  company: string;
  role: string;
  linkedIn: string;
  twitter: string;
  portfolio: string;
  affiliatePartner: string;
}

export interface PersonalInfoForm {
  fullName: string;
  displayName: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  language: string;
  darkMode: boolean;
}

export interface SecurityPasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
