import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap, of, catchError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { User } from '../models/user.model';
import { HttpClient } from '@angular/common/http';
import { BaseResponse } from '../models/base.model';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiBase = import.meta.env.NG_APP_API_URL;
  private router = inject(Router);
  private isLoggingOut = false;

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private sessionReadySubject = new BehaviorSubject<boolean>(false);
  public sessionReady$ = this.sessionReadySubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadSession();
  }

  linkKeycloak(payload: { code: string, redirectUri: string }): Observable<BaseResponse<void>> {
    return this.http.post<BaseResponse<void>>(`${this.apiBase}/api/v1/auth/link/keycloak`, payload, { withCredentials: true });
  }

  logout(): Observable<BaseResponse<void>> {
    return this.http.post<BaseResponse<void>>(`${this.apiBase}/api/v1/auth/logout`, {}, { withCredentials: true }).pipe(
      tap({
        next: () => this.performLogout(),
        error: () => this.performLogout()
      })
    );
  }

  refresh(): Observable<BaseResponse<User>> {
    return this.http.get<BaseResponse<User>>(`${this.apiBase}/api/v1/auth/refresh`, { withCredentials: true }).pipe(
      tap({
        next: response => {
          const userProfile = response?.data;
          this.currentUserSubject.next(userProfile);
          this.isAuthenticatedSubject.next(true);
        },
        error: () => {
        }
      })
    );
  }

  getCurrentUser(): Observable<BaseResponse<User>> {
    return this.http.get<BaseResponse<User>>(`${this.apiBase}/api/v1/auth/me`).pipe(
      tap({
        next: response => {
          const userProfile = response?.data;
          this.currentUserSubject.next(userProfile);
          this.isAuthenticatedSubject.next(true);
        },
        error: () => {
          this.clearSession();
        }
      })
    );
  }

  public get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  public get isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
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
        this.sessionReadySubject.next(true);
      },
      error: () => {
        this.clearSession();
        this.sessionReadySubject.next(true);
      }
    });
  }

  private clearSession() {
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }
}

