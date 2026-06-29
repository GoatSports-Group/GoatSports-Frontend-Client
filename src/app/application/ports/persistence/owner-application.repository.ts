import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { OwnerApplication } from '@domain/entity/owner-application';

export interface OwnerApplicationRepository {
  submit(formData: FormData): Observable<OwnerApplication>;
  getMyApplications(): Observable<OwnerApplication[]>;
}

export const OWNER_APPLICATION_REPOSITORY_TOKEN = new InjectionToken<OwnerApplicationRepository>('OwnerApplicationRepository');
