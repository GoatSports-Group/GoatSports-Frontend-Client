import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { OwnerApplicationRepository } from '@application/ports/persistence/owner-application.repository';
import { OwnerApplication } from '@domain/entities/owner-application';
import {
  OwnerApplicationApi,
  OwnerApplicationDocumentSlot,
  PrepareOwnerApplicationUploadRequest,
  SubmitOwnerApplicationRequest
} from '@infrastructure/api/owner-application.api';

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
  ): Observable<OwnerApplication[]> {
    const uploadTasks: Array<{ file: File; slot: OwnerApplicationDocumentSlot }> = [
      { file: files.idCardFront, slot: 'IDENTITY_FRONT' },
      { file: files.idCardBack, slot: 'IDENTITY_BACK' },
      { file: files.businessLicense, slot: 'BUSINESS_LICENSE' },
      { file: files.venueImage, slot: 'VENUE_PHOTO' }
    ];
    const prepareRequest: PrepareOwnerApplicationUploadRequest = {
      documents: uploadTasks.map(task => ({
        slot: task.slot,
        fileName: task.file.name,
        contentType: task.file.type || 'application/octet-stream'
      }))
    };
    const idempotencyKey = `owner-application:${crypto.randomUUID()}`;

    return this.ownerApplicationApi.prepareUploads(prepareRequest, idempotencyKey).pipe(
      switchMap(response => {
        const prepared = response.data;
        if (!prepared?.ownerApplicationId || prepared.documents.length !== uploadTasks.length) {
          throw new Error('Không thể chuẩn bị nơi tải hồ sơ lên.');
        }

        const documentsBySlot = new Map(
          prepared.documents.map(document => [document.slot, document])
        );
        const uploads = uploadTasks.map(task => {
          const document = documentsBySlot.get(task.slot);
          if (!document?.uploadUrl || !document.objectKey) {
            throw new Error(`Thiếu đường dẫn tải lên cho ${task.slot}.`);
          }
          return this.ownerApplicationApi.uploadToPresignedUrl(document.uploadUrl, task.file).pipe(
            map(() => ({ slot: task.slot, objectKey: document.objectKey }))
          );
        });
        const allObjectKeys = prepared.documents.map(document => document.objectKey);

        return forkJoin(uploads).pipe(
          catchError(error => this.ownerApplicationApi.cleanupUploads(
            prepared.ownerApplicationId,
            allObjectKeys
          ).pipe(
            catchError(() => of(void 0)),
            switchMap(() => throwError(() => error))
          )),
          switchMap(documents => {
            const submitRequest: SubmitOwnerApplicationRequest = {
              ...form,
              ownerApplicationId: prepared.ownerApplicationId,
              documents
            };
            return this.ownerApplicationApi.submitApplication(submitRequest);
          })
        );
      }),
      switchMap(() => this.getMyApplications())
    );
  }

  getMyApplications(): Observable<OwnerApplication[]> {
    return this.ownerApplicationApi.getMyApplications().pipe(
      map(response => response.data?.result || [])
    );
  }
}
