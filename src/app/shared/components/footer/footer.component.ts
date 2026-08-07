import { Component } from '@angular/core';
import { environment } from '@environments/environment';

@Component({
    selector: 'app-footer',
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.scss'],
    standalone: false
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
  emailInput: string = '';
  loginUrl = `${environment.authApiUrl}/login?redirect=${environment.clientApiUrl}`;

  subscribeNewsletter() {
    if (this.emailInput.trim()) {
      alert(`Cảm ơn bạn đã đăng ký nhận tin với email: ${this.emailInput}`);
      this.emailInput = '';
    }
  }
}
