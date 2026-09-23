import { Component, OnInit, inject } from '@angular/core';
import { AuthService } from './presentation/services/auth.service';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { hideBootSplashWhenReady } from './boot-splash';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false
})
export class AppComponent implements OnInit {
  title = 'Goat Sports';
  private authService = inject(AuthService);
  sessionReady$!: Observable<boolean>;

  constructor() {
    hideBootSplashWhenReady(inject(Router), this.authService.sessionReady$);
  }

  ngOnInit() {
    this.sessionReady$ = this.authService.sessionReady$;
  }

  skipToMainContent(event: Event): void {
    event.preventDefault();
    window.setTimeout(() => {
      const mainContent = document.getElementById('main-content');
      mainContent?.focus();
      mainContent?.scrollIntoView({ block: 'start' });
    });
  }
}
