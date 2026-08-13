import { OwnerApplication } from '@application/dto/owner-application/owner-application.dto';

export type OwnerApplicationProgressState =
  | 'completed'
  | 'current'
  | 'upcoming'
  | 'rejected'
  | 'cancelled';

export type OwnerApplicationProgressTone = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface OwnerApplicationProgressStep {
  title: string;
  description: string;
  state: OwnerApplicationProgressState;
  timestamp?: string;
}

export interface OwnerApplicationProgress {
  summary: string;
  tone: OwnerApplicationProgressTone;
  steps: OwnerApplicationProgressStep[];
}

export interface OwnerApplicationHistoryItem {
  application: OwnerApplication;
  progress: OwnerApplicationProgress;
}
