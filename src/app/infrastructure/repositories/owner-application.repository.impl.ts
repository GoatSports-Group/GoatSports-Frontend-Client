import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, interval, of } from 'rxjs';
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
  ): Observable<OwnerApplication[]> {

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

        return interval(1500).pipe(
          switchMap(() => this.workflowApi.getProcessInstanceVariables(instanceKey)),
          filter(response => Boolean(
            response?.data?.presignedUrls && response.data.ownerApplicationId
          )),
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
              switchMap(() => this.getMyApplications())
            );
          })
        );
      })
    );
  }

  getMyApplications(): Observable<OwnerApplication[]> {
    return this.ownerApplicationApi.getMyApplications().pipe(
      map(response => response.data?.result || []),
      switchMap(applications => {
        if (applications.length === 0) return of(applications);

        const ids = applications.map(application => application.ownerApplicationId);
        return this.workflowApi.getMyOwnerApplicationProgress(ids).pipe(
          map(response => this.mergeProgress(applications, response.data?.items ?? [])),
          catchError(error => {
            console.warn('Failed to load owner application progress:', error);
            return of(applications);
          })
        );
      })
    );
  }

  private mergeProgress(
    applications: OwnerApplication[],
    progressItems: { ownerApplicationId: string; receivedAt?: string; viewedAt?: string }[]
  ): OwnerApplication[] {
    const progressByApplicationId = new Map(
      progressItems.map(progress => [progress.ownerApplicationId, progress])
    );

    return applications.map(application => ({
      ...application,
      ...progressByApplicationId.get(application.ownerApplicationId)
    }));
  }
}
