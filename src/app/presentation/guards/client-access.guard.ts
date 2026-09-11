import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, RouterStateSnapshot } from '@angular/router';
import { Observable, filter, map, take } from 'rxjs';
import { environment } from '@environments/environment';
import { AuthService } from '@presentation/services/auth.service';

const DASHBOARD_ROLES = new Set(['ADMIN', 'VENUE_OWNER']);

@Injectable({
  providedIn: 'root'
})
export class ClientAccessGuard implements CanActivate {
  private readonly authService = inject(AuthService);

  canActivate(
    _route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.authService.sessionReady$.pipe(
      filter(Boolean),
      take(1),
      map(() => {
        const roleName = this.authService.currentUser?.role?.name?.toUpperCase() ?? '';
        if (!DASHBOARD_ROLES.has(roleName)) {
          return true;
        }

        const adminUrl = environment.adminApiUrl.replace(/\/+$/, '');
        window.location.replace(`${adminUrl}/admin/dashboard`);
        return false;
      })
    );
  }
}
