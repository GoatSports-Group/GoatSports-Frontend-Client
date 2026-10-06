import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { SUPPORT_REPOSITORY_TOKEN, SupportTopic } from '@application/ports/persistence/support.repository';
import { AuthService } from '@presentation/services/auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { SelectOption } from '@shared/components/ui/select/select.component';

/** Hop thu nhan yeu cau (auth-service gui toi day qua Gmail SMTP); hien o cot thong tin lien he cho khop. */
export const SUPPORT_EMAIL = 'goatsports1312@gmail.com';

const TOPICS: ReadonlyArray<{ value: SupportTopic; label: string }> = [
  { value: 'BOOKING', label: 'Đặt sân & thanh toán' },
  { value: 'REFUND', label: 'Hủy sân & hoàn tiền' },
  { value: 'CLUB_TOURNAMENT', label: 'Câu lạc bộ & giải đấu' },
  { value: 'ACCOUNT', label: 'Tài khoản & đăng nhập' },
  { value: 'FEEDBACK', label: 'Góp ý khác' }
];

/**
 * Lien he ho tro: gui yeu cau that (POST /auth-service/api/v1/support/requests) toi hop thu ho tro, tra loi
 * qua email nguoi gui. Da dang nhap thi dien san ten va email. Gui xong hien trang thai "Da gui".
 */
@Component({
  selector: 'app-contact-support',
  templateUrl: './contact-support.component.html',
  styleUrls: ['./contact-support.component.scss'],
  standalone: false
})
export class ContactSupportComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly notify = inject(NotifyService);
  private readonly support = inject(SUPPORT_REPOSITORY_TOKEN);
  private readonly auth = inject(AuthService);

  readonly supportEmail = SUPPORT_EMAIL;
  readonly topicOptions: SelectOption[] = TOPICS.map(topic => ({ value: topic.value, label: topic.label }));
  readonly submitting = signal(false);
  /** Yeu cau vua gui thanh cong; khac null thi hien trang thai "Da gui" thay cho form. */
  readonly sent = signal<{ email: string; topic: string; subject: string } | null>(null);

  contactForm!: FormGroup;

  ngOnInit(): void {
    const user = this.auth.currentUser;
    this.contactForm = this.fb.group({
      fullName: [user?.fullName ?? '', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      email: [user?.email ?? '', [Validators.required, Validators.email, Validators.maxLength(160)]],
      topic: [null as SupportTopic | null, Validators.required],
      subject: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(160)]],
      message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(4000)]]
    });
  }

  invalid(name: string): boolean {
    const control = this.contactForm.get(name);
    return !!control && control.touched && control.invalid;
  }

  get messageLength(): number {
    return (this.contactForm.get('message')?.value as string | null)?.length ?? 0;
  }

  onSubmit(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      this.notify.warning('Vui lòng kiểm tra lại các thông tin bắt buộc.');
      return;
    }
    const value = this.contactForm.getRawValue();
    this.submitting.set(true);
    this.contactForm.disable();
    this.support.submit({
      fullName: value.fullName.trim(),
      email: value.email.trim(),
      topic: value.topic,
      subject: value.subject.trim(),
      message: value.message.trim()
    }).pipe(finalize(() => {
      this.submitting.set(false);
      this.contactForm.enable();
    })).subscribe({
      next: () => this.sent.set({
        email: value.email.trim(),
        topic: TOPICS.find(topic => topic.value === value.topic)?.label ?? '',
        subject: value.subject.trim()
      }),
      error: error => this.notify.error(error?.error?.message || 'Chưa gửi được yêu cầu. Vui lòng thử lại sau ít phút.')
    });
  }

  /** Gui them yeu cau: giu ten va email, xoa phan noi dung. */
  sendAnother(): void {
    this.sent.set(null);
    this.contactForm.patchValue({ topic: null, subject: '', message: '' });
    this.contactForm.markAsUntouched();
  }
}
