import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { BaseResponse } from '@application/dto/base/base-response';
import { User } from '@application/dto/user/user.dto';
import { SessionStateService } from '@presentation/services/session-state.service';
import { LogoutUseCase } from '@application/usecase/auth/logout.usecase';
import { RefreshTokenUseCase } from '@application/usecase/auth/refresh-token.usecase';
import { GetCurrentUserUseCase } from '@application/usecase/auth/get-current-user.usecase';
import { LinkKeycloakUseCase } from '@application/usecase/auth/link-keycloak.usecase';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private sessionStateService = inject(SessionStateService);
  private router = inject(Router);

  private logoutUseCase = inject(LogoutUseCase);
  private refreshTokenUseCase = inject(RefreshTokenUseCase);
  private getCurrentUserUseCase = inject(GetCurrentUserUseCase);
  private linkKeycloakUseCase = inject(LinkKeycloakUseCase);

  private isLoggingOut = false;

  public currentUser$ = this.sessionStateService.currentUser$;
  public isAuthenticated$ = this.sessionStateService.isAuthenticated$;
  public sessionReady$ = this.sessionStateService.sessionReady$;

  constructor() {
    this.loadSession();
  }

  linkKeycloak(payload: { code: string; redirectUri: string }): Observable<BaseResponse<void>> {
    return this.linkKeycloakUseCase.execute(payload);
  }

  logout(): Observable<BaseResponse<void>> {
    return this.logoutUseCase.execute().pipe(
      tap({
        next: () => this.performLogout(),
        error: () => this.performLogout()
      })
    );
  }

  refresh(): Observable<BaseResponse<User>> {
    return this.refreshTokenUseCase.execute().pipe(
      tap({
        next: response => {
          const userProfile = response?.data;
          this.sessionStateService.setCurrentUser(userProfile || null);
        },
        error: () => { }
      })
    );
  }

  getCurrentUser(): Observable<BaseResponse<User>> {
    return this.getCurrentUserUseCase.execute().pipe(
      tap({
        next: response => {
          const userProfile = response?.data;
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

  private clearSession() {
    this.sessionStateService.clearSession();
  }
}
