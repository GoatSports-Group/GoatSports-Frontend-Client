import { InjectionToken } from '@angular/core';

export interface CurrentUserProvider {
  getCurrentUserId(): string | null;
}

export const CURRENT_USER_PROVIDER_TOKEN = new InjectionToken<CurrentUserProvider>(
  'CurrentUserProvider'
);
