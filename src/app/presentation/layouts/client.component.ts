import { Component, ViewChild, inject, OnInit } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
import { AuthService } from '../services/auth.service';
import { Observable } from 'rxjs';
import { User } from '../../domain/entities/user';
import { Router } from '@angular/router';

@Component({
  selector: 'app-client',
  templateUrl: './client.component.html',
  styleUrls: ['./client.component.scss']
})
export class ClientComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  @ViewChild('sidenav') sidenav!: MatSidenav;

  isAuthenticated$!: Observable<boolean>;
  currentUser: User | null = null;
  adminUrl = import.meta.env.NG_APP_ADMIN_API_URL;

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

  logout() {
    this.authService.logout().subscribe();
  }

  redirectToLogin() {
    const clientUrl = import.meta.env.NG_APP_CLIENT_API_URL;
    const authUrl = import.meta.env.NG_APP_AUTH_API_URL;
    const currentUrl = encodeURIComponent(`${clientUrl}${this.router.url}`);
    window.location.href = `${authUrl}/login?redirect=${currentUrl}`;
  }
}
