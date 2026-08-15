import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { User } from '@application/dto/user/user.dto';
import { SessionStateService } from '@presentation/services/session-state.service';
import { LogoutUseCase } from '@application/usecase/auth/logout.usecase';
import { RefreshTokenUseCase } from '@application/usecase/auth/refresh-token.usecase';
import { GetCurrentUserUseCase } from '@application/usecase/auth/get-current-user.usecase';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private sessionStateService = inject(SessionStateService);
  private router = inject(Router);

  private logoutUseCase = inject(LogoutUseCase);
  private refreshTokenUseCase = inject(RefreshTokenUseCase);
  private getCurrentUserUseCase = inject(GetCurrentUserUseCase);

  private isLoggingOut = false;

  public currentUser$ = this.sessionStateService.currentUser$;
  public isAuthenticated$ = this.sessionStateService.isAuthenticated$;
  public sessionReady$ = this.sessionStateService.sessionReady$;

  constructor() {
    this.loadSession();
  }

  logout(): Observable<void> {
    return this.logoutUseCase.execute().pipe(
      tap({
        next: () => this.performLogout(),
        error: () => this.performLogout()
      })
    );
  }

  refresh(): Observable<User> {
    return this.refreshTokenUseCase.execute().pipe(
      tap({
        next: userProfile => {
          this.sessionStateService.setCurrentUser(userProfile || null);
        },
        error: () => { }
      })
    );
  }

  getCurrentUser(): Observable<User> {
    return this.getCurrentUserUseCase.execute().pipe(
      tap({
        next: userProfile => {
          this.sessionStateService.setCurrentUser(userProfile || null);
        },
        error: () => {
          this.clearSession();
        }
      })
    );
  }

  public get currentUser(): User | null {
    return this.sessionStateService.getCurrentUser();
  }

  public updateCurrentUser(user: User): void {
    this.sessionStateService.setCurrentUser(user);
  }

  public get isAuthenticated(): boolean {
    return this.sessionStateService.getIsAuthenticated();
  }

  public performLogout() {
    if (this.isLoggingOut) {
      console.log('Already logging out...');
      return;
    }

    this.isLoggingOut = true;
    console.log('Performing logout...');
    this.clearSession();

    this.router.navigate(['/home']).then(() => {
      setTimeout(() => {
        this.isLoggingOut = false;
      }, 1000);
    });
  }

  private loadSession() {
    this.getCurrentUser().subscribe({
      next: () => {
        this.sessionStateService.setSessionReady(true);
      },
      error: () => {
        this.refresh().subscribe({
          next: () => {
            this.sessionStateService.setSessionReady(true);
          },
          error: () => {
            this.clearSession();
            this.sessionStateService.setSessionReady(true);
          }
        });
      }
    });
  }

  private clearSession() {
    this.sessionStateService.clearSession();
  }
}
