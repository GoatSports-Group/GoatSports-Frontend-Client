export type ProfileTabKey = 'info' | 'settings' | 'security';

export interface ProfileTabItem {
  key: ProfileTabKey;
  label: string;
  icon: string;
  description: string;
}

export interface ProfileSettingsForm {
  darkMode: boolean;
  emailBooking: boolean;
  emailPromo: boolean;
  emailSecurity: boolean;
  language: string;
}

export interface PasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const PROFILE_TABS: ProfileTabItem[] = [
  {
    key: 'info',
    label: 'Hồ Sơ',
    icon: 'user',
    description: 'Thông tin cá nhân & định danh tài khoản'
  },
  {
    key: 'settings',
    label: 'Cài Đặt',
    icon: 'sliders',
    description: 'Tùy chọn giao diện, ngôn ngữ & thông báo'
  },
  {
    key: 'security',
    label: 'Bảo Mật',
    icon: 'shield-check',
    description: 'Quản lý mật khẩu & an toàn tài khoản'
  }
];
