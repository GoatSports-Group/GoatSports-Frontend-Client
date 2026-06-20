import { Injectable, inject, Injector } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { AuthService } from '@presentation/services/auth.service';

@Injectable()
export class ApiInterceptor implements HttpInterceptor {
  private injector = inject(Injector);
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<any>(null);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const cloned = req.clone({
      withCredentials: true
    });

    const isRefreshEndpoint = req.url.includes('/auth-service/api/v1/auth/refresh');
    const isAuthEndpoint =
      req.url.includes('/auth-service/api/v1/auth/login') ||
      req.url.includes('/auth-service/api/v1/auth/register') ||
      req.url.includes('/auth-service/api/v1/auth/verify');

    if (this.isRefreshing && !isRefreshEndpoint && !isAuthEndpoint) {
      return this.refreshTokenSubject.pipe(
        filter(value => value !== null),
        take(1),
        switchMap(() => next.handle(cloned))
      );
    }

    if (req.headers.has('X-Retry')) {
      return next.handle(cloned);
    }

    return next.handle(cloned).pipe(
      catchError((error: HttpErrorResponse) => {
        const authService = this.injector.get(AuthService);
        const isUnauthorized = error.status === 401;
        const isRefreshEndpoint = req.url.includes('/auth-service/api/v1/auth/refresh');

        if (isUnauthorized && isRefreshEndpoint) {
          console.log('Refresh token endpoint failed, logging out...');
          authService.performLogout();
          return throwError(() => error);
        }

        if (
          isUnauthorized &&
          !req.url.includes('/auth-service/api/v1/auth/login') &&
          !req.url.includes('/auth-service/api/v1/auth/register')
        ) {
          const errorMsg = error.error?.message;
          const isRefreshTokenExpired =
            errorMsg === 'Refresh token hết hạn' ||
            errorMsg === 'Refresh token không hợp lệ hoặc đã hết hạn' ||
            errorMsg === 'Hết hạn đăng nhập';

          if (isRefreshTokenExpired) {
            console.log('Refresh token is expired/invalid, logging out...');
            authService.performLogout();
            return throwError(() => error);
          }

          return this.handle401Error(cloned, next);
        }
        return throwError(() => error);
      })
    );
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const authService = this.injector.get(AuthService);

    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return authService.refresh().pipe(
        switchMap((response) => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(response.data);

          const retryRequest = request.clone({
            headers: request.headers.set('X-Retry', 'true')
          });
          return next.handle(retryRequest);
        }),
        catchError((err) => {
          this.isRefreshing = false;
          this.refreshTokenSubject.error(err);
          this.refreshTokenSubject = new BehaviorSubject<any>(null);

          authService.performLogout();
          return throwError(() => err);
        })
      );
    } else {
      return this.refreshTokenSubject.pipe(
        filter(token => token !== null),
        take(1),
        switchMap(() => {
          const retryRequest = request.clone({
            headers: request.headers.set('X-Retry', 'true')
          });
          return next.handle(retryRequest);
        }),
        catchError((err) => {
          return throwError(() => err);
        })
      );
    }
  }
}
