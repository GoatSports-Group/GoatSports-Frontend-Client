import { Injectable, inject } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, filter, take } from 'rxjs/operators';
import { AuthService } from '@presentation/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private clientApiBase = environment.clientApiUrl;
  private authApiBase = environment.authApiUrl;

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

        window.location.href = `${this.authApiBase}/login?redirect=${encodeURIComponent(window.location.origin + state.url)}`;
        return false;
      })
    );
  }
}
