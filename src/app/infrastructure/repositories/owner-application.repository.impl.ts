import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { OwnerApplicationRepository } from '@application/ports/persistence/owner-application.repository';
import { OwnerApplication } from '@domain/entity/owner-application';
import { OwnerApplicationApi } from '@infrastructure/api/owner-application.api';

@Injectable({
  providedIn: 'root'
})
export class OwnerApplicationRepositoryImpl implements OwnerApplicationRepository {
  private ownerApplicationApi = inject(OwnerApplicationApi);

  submit(
    form: any,
    files: {
      idCardFront: File;
      idCardBack: File;
      businessLicense?: File | null;
      venueImage?: File | null;
    }
  ): Observable<OwnerApplication> {
    return this.ownerApplicationApi.submit(form).pipe(
      switchMap(response => {
        const application = response.data;
        const ownerApplicationId = application.ownerApplicationId;

        const uploadTasks: { file: File; folder: string }[] = [
          { file: files.idCardFront, folder: 'identities' },
          { file: files.idCardBack, folder: 'identities' }
        ];

        if (files.businessLicense) {
          uploadTasks.push({ file: files.businessLicense, folder: 'licenses' });
        }
        if (files.venueImage) {
          uploadTasks.push({ file: files.venueImage, folder: 'venues' });
        }

        const presignedRequests = uploadTasks.map(task => ({
          fileName: task.file.name,
          contentType: task.file.type,
          folder: task.folder
        }));

        return this.ownerApplicationApi.getPresignedUrls(presignedRequests).pipe(
          map(res => res.data),
          switchMap(presignedUrls => {
            const uploadObservables = uploadTasks.map((task, index) => {
              const presigned = presignedUrls[index];
              return this.ownerApplicationApi.uploadToPresignedUrl(presigned.uploadUrl, task.file).pipe(
                map(() => presigned.objectKey)
              );
            });

            return forkJoin(uploadObservables).pipe(
              switchMap(objectKeys => {
                return this.ownerApplicationApi.createDocuments(ownerApplicationId, objectKeys).pipe(
                  map(() => application)
                );
              })
            );
          })
        );
      })
    );
  }

  getMyApplications(): Observable<OwnerApplication[]> {
    return this.ownerApplicationApi.getMyApplications().pipe(
      map(response => response.data?.result || [])
    );
  }
}
