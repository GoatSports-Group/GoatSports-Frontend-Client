import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { User } from '@application/dto/user/user.dto';
import { CurrentUserProvider } from '@application/ports/current-user.provider';

@Injectable({
  providedIn: 'root'
})
export class SessionStateService implements CurrentUserProvider {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private sessionReadySubject = new BehaviorSubject<boolean>(false);
  public sessionReady$ = this.sessionReadySubject.asObservable();

  setCurrentUser(user: User | null): void {
    this.currentUserSubject.next(user);
    this.isAuthenticatedSubject.next(!!user);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getCurrentUserId(): string | null {
    return this.currentUserSubject.value?.userId ?? null;
  }

  setSessionReady(ready: boolean): void {
    this.sessionReadySubject.next(ready);
  }

  getIsAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  get sessionReady(): boolean {
    return this.sessionReadySubject.value;
  }

  clearSession(): void {
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }
}
