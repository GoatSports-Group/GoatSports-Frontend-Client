import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { OwnerApplicationRepository } from '@application/ports/persistence/owner-application.repository';
import { OwnerApplication } from '@domain/entities/owner-application';
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
      businessLicense: File;
      venueImage: File;
    }
  ): Observable<OwnerApplication> {

    const uploadTasks: { file: File; folder: string }[] = [
      { file: files.idCardFront, folder: 'identities' },
      { file: files.idCardBack, folder: 'identities' },
      { file: files.businessLicense, folder: 'licenses' },
      { file: files.venueImage, folder: 'venues' }
    ];

    const presignedRequests = uploadTasks.map(task => ({
      fileName: task.file.name,
      contentType: task.file.type,
      folder: task.folder
    }));

    return forkJoin({
      submitResponse: this.ownerApplicationApi.submit(form),
      presignedResponse: this.ownerApplicationApi.getPresignedUrls(presignedRequests)
    }).pipe(
      switchMap(({ submitResponse, presignedResponse }) => {

        const application = submitResponse.data;
        const ownerApplicationId = application.ownerApplicationId;
        const presignedUrls = presignedResponse.data;

        const uploads = uploadTasks.map((task, index) => {
          const presigned = presignedUrls[index];

          return this.ownerApplicationApi
            .uploadToPresignedUrl(presigned.uploadUrl, task.file)
            .pipe(map(() => presigned.objectKey));

        });

        return forkJoin(uploads).pipe(
          switchMap(objectKeys =>
            this.ownerApplicationApi
              .createDocuments(ownerApplicationId, objectKeys)
              .pipe(map(() => application))
          )
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
