import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { OwnerApplicationRepository, OWNER_APPLICATION_REPOSITORY_TOKEN } from '@application/ports/persistence/owner-application.repository';
import { OwnerApplication } from '@domain/entity/owner-application';

@Injectable({
  providedIn: 'root'
})
export class SubmitOwnerApplicationUseCase {
  constructor(
    @Inject(OWNER_APPLICATION_REPOSITORY_TOKEN) private repository: OwnerApplicationRepository
  ) { }

  execute(formData: FormData): Observable<OwnerApplication> {
    return this.repository.submit(formData);
  }
}
