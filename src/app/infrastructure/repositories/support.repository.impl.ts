import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { SupportRepository, SupportRequestPayload } from '@application/ports/persistence/support.repository';
import { API_ENDPOINTS } from '@infrastructure/config/api-endpoints';

@Injectable({ providedIn: 'root' })
export class SupportRepositoryImpl implements SupportRepository {
  private readonly http = inject(HttpClient);

  submit(request: SupportRequestPayload): Observable<void> {
    return this.http.post(`${API_ENDPOINTS.auth}/support/requests`, request).pipe(map(() => undefined));
  }
}
