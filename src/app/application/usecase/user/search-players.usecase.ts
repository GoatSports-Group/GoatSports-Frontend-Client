import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PlayerSummary } from '@application/dto/user/user.dto';
import { USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';

@Injectable({ providedIn: 'root' })
export class SearchPlayersUseCase {
  private readonly repository = inject(USER_REPOSITORY_TOKEN);

  execute(query: string): Observable<PlayerSummary[]> {
    return this.repository.searchPlayers(query);
  }
}
