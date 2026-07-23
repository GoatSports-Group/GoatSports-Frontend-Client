import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
    selector: 'app-contact-support',
    templateUrl: './contact-support.component.html',
    styleUrls: ['./contact-support.component.scss'],
    standalone: false
})
export class ContactSupportComponent implements OnInit {
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  contactForm!: FormGroup;
  submitting = false;

  ngOnInit() {
    this.contactForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      subject: ['', [Validators.required, Validators.minLength(5)]],
      message: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  onSubmit() {
    if (this.contactForm.invalid) {
      return;
    }

    this.submitting = true;

    // Simulate API call
    setTimeout(() => {
      this.snackBar.open('Gửi yêu cầu liên hệ thành công! Chúng tôi sẽ phản hồi bạn sớm.', 'Đóng', {
        duration: 5000,
        horizontalPosition: 'end',
        verticalPosition: 'top',
        panelClass: ['snackbar-success']
      });

      this.contactForm.reset();
      this.submitting = false;
    }, 1000);
  }
}
