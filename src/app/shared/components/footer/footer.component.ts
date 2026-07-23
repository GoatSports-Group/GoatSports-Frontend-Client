import { Component } from '@angular/core';

@Component({
    selector: 'app-footer',
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.scss'],
    standalone: false
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
  emailInput: string = '';
  loginUrl = `${import.meta.env.NG_APP_AUTH_API_URL}/login?redirect=${import.meta.env.NG_APP_CLIENT_API_URL}`;

  subscribeNewsletter() {
    if (this.emailInput.trim()) {
      alert(`Cảm ơn bạn đã đăng ký nhận tin với email: ${this.emailInput}`);
      this.emailInput = '';
    }
  }
}
