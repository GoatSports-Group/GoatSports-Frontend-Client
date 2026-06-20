import { Injectable, inject } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, filter, take } from 'rxjs/operators';
import { AuthService } from '@presentation/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private clientApiBase = import.meta.env.NG_APP_CLIENT_API_URL;
  private authApiBase = import.meta.env.NG_APP_AUTH_API_URL;

  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.authService.sessionReady$.pipe(
      filter(ready => ready === true),
      take(1),
      map(() => {
        if (this.authService.isAuthenticated) {
          return true;
        }

        this.snackBar.open('Vui lòng đăng nhập để sử dụng chức năng này!', 'Đóng', {
          duration: 3000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-warning']
        });

        const redirectUrl = encodeURIComponent(`${this.clientApiBase}${state.url}`);
        window.location.href = `${this.authApiBase}/auth/login?redirect=${redirectUrl}`;
        return false;
      })
    );
  }
}
