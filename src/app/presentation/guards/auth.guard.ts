import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '@presentation/services/auth.service';
import { Observable } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private authService = inject(AuthService);

  canActivate(_route: ActivatedRouteSnapshot, _state: RouterStateSnapshot): Observable<boolean> {
    return this.authService.sessionReady$.pipe(
      filter(ready => ready === true),
      take(1),
      map(() => {
        if (this.authService.isAuthenticated) {
          return true;
        }

        this.authService.notifyAuthenticationRequired();
        return false;
      })
    );
  }
}
