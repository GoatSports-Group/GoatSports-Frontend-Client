import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, tap } from 'rxjs';
import { User } from '@application/dto/user/user.dto';
import { USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';

@Injectable({ providedIn: 'root' })
export class PlayerDirectoryService {
  private readonly userRepository = inject(USER_REPOSITORY_TOKEN);
  private readonly cache = new Map<string, User>();

  resolve(userIds: readonly string[]): Observable<ReadonlyMap<string, User>> {
    const requestedIds = [...new Set(userIds.filter(Boolean))];
    const missingIds = requestedIds.filter(userId => !this.cache.has(userId));
    if (!missingIds.length) return of(this.pick(requestedIds));

    return forkJoin(missingIds.map(userId =>
      this.userRepository.getUserById(userId).pipe(catchError(() => of(null)))
    )).pipe(
      tap(users => users.forEach(user => {
        if (user) this.cache.set(user.userId, user);
      })),
      map(() => this.pick(requestedIds))
    );
  }

  private pick(userIds: readonly string[]): ReadonlyMap<string, User> {
    const result = new Map<string, User>();
    userIds.forEach(userId => {
      const user = this.cache.get(userId);
      if (user) result.set(userId, user);
    });
    return result;
  }
}
