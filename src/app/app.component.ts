import { Component, OnInit, inject } from '@angular/core';
import { AuthService } from './presentation/services/auth.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false
})
export class AppComponent implements OnInit {
  title = 'Goat Sports';
  private authService = inject(AuthService);
  sessionReady$!: Observable<boolean>;

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
