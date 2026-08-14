import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { CompleteTaskRequest, ProcessInstanceResponse, ProcessInstanceVariablesResponse, StartProcessRequest, UserTaskResponse } from '@application/dto/workflow/workflow.dto';
import { OwnerApplicationProgressResponse } from '@application/dto/workflow/owner-application-progress.dto';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WorkflowApi {
  private http = inject(HttpClient);
  private apiBase = environment.apiUrl;

  startWorkflow(variables: StartProcessRequest): Observable<BaseResponse<ProcessInstanceResponse>> {
    return this.http.post<BaseResponse<ProcessInstanceResponse>>(
      `${this.apiBase}/workflow-service/api/v1/workflows/start`,
      { variables }
    );
  }

  getProcessInstanceVariables(instanceKey: number | string): Observable<BaseResponse<ProcessInstanceVariablesResponse>> {
    return this.http.get<BaseResponse<ProcessInstanceVariablesResponse>>(
      `${this.apiBase}/workflow-service/api/v1/workflows/instances/${instanceKey}/variables`
    );
  }

  getTasksByProcessInstance(instanceKey: number | string): Observable<BaseResponse<UserTaskResponse>> {
    return this.http.get<BaseResponse<UserTaskResponse>>(
      `${this.apiBase}/workflow-service/api/v1/workflows/instances/${instanceKey}/tasks`
    );
  }

  completeUserTask(completeTask: CompleteTaskRequest): Observable<BaseResponse<void>> {
    return this.http.post<BaseResponse<void>>(
      `${this.apiBase}/workflow-service/api/v1/workflows/tasks/${completeTask.taskKey}/complete`,
      completeTask.completeTask
    );
  }

  getMyOwnerApplicationProgress(ownerApplicationIds: string[]): Observable<BaseResponse<OwnerApplicationProgressResponse>> {
    return this.http.post<BaseResponse<OwnerApplicationProgressResponse>>(
      `${this.apiBase}/workflow-service/api/v1/workflows/owner-applications/my/progress/search`,
      { ownerApplicationIds }
    );
  }
}
