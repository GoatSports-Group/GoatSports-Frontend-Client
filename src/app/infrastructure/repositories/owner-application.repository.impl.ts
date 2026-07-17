import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, interval } from 'rxjs';
import { map, switchMap, filter, take } from 'rxjs/operators';
import { OwnerApplicationRepository } from '@application/ports/persistence/owner-application.repository';
import { OwnerApplication } from '@domain/entities/owner-application';
import { OwnerApplicationApi } from '@infrastructure/api/owner-application.api';
import { WorkflowApi } from '@infrastructure/api/workflow.api';

@Injectable({
  providedIn: 'root'
})
export class OwnerApplicationRepositoryImpl implements OwnerApplicationRepository {
  private ownerApplicationApi = inject(OwnerApplicationApi);
  private workflowApi = inject(WorkflowApi);

  submit(
    form: any,
    files: {
      idCardFront: File;
      idCardBack: File;
      businessLicense: File;
      venueImage: File;
    }
  ): Observable<void> {

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

    const workflowVariables = {
      ...form,
      presignedRequests
    };

    return this.workflowApi.startWorkflow(workflowVariables).pipe(
      switchMap(startResponse => {
        const instanceKey = startResponse.data.processInstanceKey;

        return interval(3000).pipe(
          switchMap(() => this.workflowApi.getProcessInstanceVariables(instanceKey)),
          filter(response => response && response.data && response.data.presignedUrls && response.data.ownerApplicationId !== ""),
          take(1),
          map(response => {
            const ownerApplicationId = response.data.ownerApplicationId;
            const presignedUrls = response.data.presignedUrls;

            return {
              instanceKey,
              ownerApplicationId,
              presignedUrls
            };
          })
        );
      }),

      switchMap(({ instanceKey, ownerApplicationId, presignedUrls }) => {
        const uploads = uploadTasks.map((task, index) => {
          const presigned = presignedUrls[index];

          return this.ownerApplicationApi
            .uploadToPresignedUrl(presigned.uploadUrl, task.file)
            .pipe(map(() => presigned.objectKey));
        });

        return forkJoin(uploads).pipe(
          map(objectKeys => ({
            instanceKey,
            ownerApplicationId,
            objectKeys
          }))
        );
      }),

      switchMap(({ instanceKey, ownerApplicationId, objectKeys }) => {
        return this.workflowApi.getTasksByProcessInstance(instanceKey).pipe(
          map(task => {
            if (!task || !task.data) {
              throw new Error('User upload task not found in workflow');
            }
            return task.data;
          }),

          switchMap(task => {
            const completeTask = {
              taskKey: task.key,
              completeTask: {
                variables: {
                  documentKeys: objectKeys
                }
              }
            };
            return this.workflowApi.completeUserTask(completeTask).pipe(
              map(response => response.data)
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
