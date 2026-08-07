import { Component, ViewChild, inject, OnInit } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
import { AuthService } from '@presentation/services/auth.service';
import { Observable } from 'rxjs';
import { User } from '@application/dto/user/user.dto';
import { Router } from '@angular/router';
import { environment } from '@environments/environment';

@Component({
    selector: 'app-client',
    templateUrl: './client.component.html',
    styleUrls: ['./client.component.scss'],
    standalone: false
})
export class ClientComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  @ViewChild('sidenav') sidenav!: MatSidenav;

  isAuthenticated$!: Observable<boolean>;
  currentUser: User | null = null;
  adminUrl = environment.adminApiUrl;

  ngOnInit() {
    this.isAuthenticated$ = this.authService.isAuthenticated$;
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  toggleSidenav() {
    this.sidenav.toggle();
  }

  closeSidenav() {
    this.sidenav.close();
  }

  private authApiBase = environment.authApiUrl;

  logout() {
    this.authService.logout().subscribe();
  }

  redirectToLogin() {
    window.location.href = `${this.authApiBase}/login?redirect=${encodeURIComponent(window.location.origin + this.router.url)}`;
  }
}
