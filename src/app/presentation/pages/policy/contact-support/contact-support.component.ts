import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NotifyService } from '@shared/components/notify/notify.service';

@Component({
    selector: 'app-contact-support',
    templateUrl: './contact-support.component.html',
    styleUrls: ['./contact-support.component.scss'],
    standalone: false
})
export class ContactSupportComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly notify = inject(NotifyService);

  contactForm!: FormGroup;
  submitting = false;

  ngOnInit(): void {
    this.contactForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      subject: ['', [Validators.required, Validators.minLength(5)]],
      message: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  onSubmit(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      this.notify.warning('Vui lòng kiểm tra lại các thông tin bắt buộc.');
      return;
    }

    this.submitting = true;

    setTimeout(() => {
      this.notify.success('Đã gửi yêu cầu hỗ trợ. Chúng tôi sẽ phản hồi bạn sớm.');

      this.contactForm.reset();
      this.submitting = false;
    }, 1000);
  }
}
