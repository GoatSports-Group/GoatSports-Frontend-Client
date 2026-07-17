import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseResponse } from '@application/dto/base/base-response';
import { CompleteTaskRequest, ProcessInstanceResponse, ProcessInstanceVariablesResponse, StartProcessRequest, UserTaskResponse } from '@application/dto/workflow/workflow.dto';

@Injectable({
  providedIn: 'root'
})
export class WorkflowApi {
  private http = inject(HttpClient);
  private apiBase = import.meta.env.NG_APP_API_URL;

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

  getUserTasks(assignee?: string): Observable<any[]> {
    const url = assignee
      ? `${this.apiBase}/workflow-service/api/v1/workflows/tasks?assignee=${assignee}`
      : `${this.apiBase}/workflow-service/api/v1/workflows/tasks`;

    return this.http.get<any>(url).pipe(
      map(response => response.data || [])
    );
  }
}
