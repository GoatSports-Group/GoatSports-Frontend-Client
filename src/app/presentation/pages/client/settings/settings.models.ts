export type SettingsTabKey = 'player' | 'personal' | 'security';

export interface SettingsTabItem {
  key: SettingsTabKey;
  label: string;
}

export const SETTINGS_TABS: SettingsTabItem[] = [
  { key: 'player', label: 'Mentee / Player profile' },
  { key: 'personal', label: 'Personal Info' },
  { key: 'security', label: 'Login & Security' }
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
