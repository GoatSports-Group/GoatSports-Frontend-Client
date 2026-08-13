import { Component, inject } from '@angular/core';
import { environment } from '@environments/environment';
import { NotifyService } from '@shared/components/notify/notify.service';

@Component({
    selector: 'app-footer',
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.scss'],
    standalone: false
})
export class FooterComponent {
  private readonly notify = inject(NotifyService);

  readonly currentYear = new Date().getFullYear();
  readonly loginUrl = `${environment.authApiUrl}/login?redirect=${environment.clientApiUrl}`;
  emailInput = '';

  subscribeNewsletter(): void {
    const email = this.emailInput.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.notify.warning('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    this.notify.success(`Đã đăng ký nhận bản tin với email ${email}.`);
    this.emailInput = '';
  }
}
