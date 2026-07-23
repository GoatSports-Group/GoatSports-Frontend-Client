import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { OwnerApplication } from '@domain/entities/owner-application';

export interface OwnerApplicationRepository {
  submit(
    form: any,
    files: {
      idCardFront: File;
      idCardBack: File;
      businessLicense: File;
      venueImage: File;
    }
  ): Observable<OwnerApplication[]>;
  getMyApplications(): Observable<OwnerApplication[]>;
}

export const OWNER_APPLICATION_REPOSITORY_TOKEN = new InjectionToken<OwnerApplicationRepository>('OwnerApplicationRepository');
