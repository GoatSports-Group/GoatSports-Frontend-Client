import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/** Chu de yeu cau ho tro (auth-service doi chieu dung bo ma nay). */
export type SupportTopic = 'BOOKING' | 'REFUND' | 'CLUB_TOURNAMENT' | 'ACCOUNT' | 'FEEDBACK';

export interface SupportRequestPayload {
  fullName: string;
  email: string;
  topic: SupportTopic;
  subject: string;
  message: string;
}

/** Trang "Lien he ho tro": gui yeu cau toi hop thu ho tro (khach chua dang nhap cung gui duoc). */
export interface SupportRepository {
  submit(request: SupportRequestPayload): Observable<void>;
}

export const SUPPORT_REPOSITORY_TOKEN = new InjectionToken<SupportRepository>('SUPPORT_REPOSITORY_TOKEN');
