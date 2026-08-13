import { Component, EventEmitter, HostListener, Output, inject } from '@angular/core';
import { OwnerApplication } from '@domain/entities/owner-application';
import { SubmitOwnerApplicationUseCase } from '@application/usecase/owner-application/submit-owner-application.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import {
  OwnerApplicationFiles,
  OwnerApplicationFormValue,
  OwnerFileKey,
  OwnerStep,
  createOwnerApplicationFiles,
  createOwnerApplicationForm
} from '../owner-application.models';
import { OwnerApplicationValidator } from '../validation/owner-application.validator';

@Component({
  selector: 'app-owner-application-form',
  templateUrl: './owner-application-form.component.html',
  styleUrls: ['./owner-application-form.component.scss'],
  standalone: false
})
export class OwnerApplicationFormComponent {
  private readonly submitApplication = inject(SubmitOwnerApplicationUseCase);
  private readonly notify = inject(NotifyService);

  @Output() backToHistory = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<OwnerApplication[]>();

  readonly steps: OwnerStep[] = [
    { number: 1, title: 'Người đại diện', description: 'Thông tin cá nhân' },
    { number: 2, title: 'Cơ sở', description: 'Thông tin kinh doanh' },
    { number: 3, title: 'Địa chỉ', description: 'Địa chỉ cơ sở' },
    { number: 4, title: 'Hồ sơ', description: 'Giấy tờ pháp lý' }
  ];

  form: OwnerApplicationFormValue = createOwnerApplicationForm();
  files: OwnerApplicationFiles = createOwnerApplicationFiles();
  currentStep = 1;
  submitting = false;

  get currentStepData(): OwnerStep {
    return this.steps[this.currentStep - 1];
  }

  goToStep(step: number): void {
    if (step >= 1 && step <= this.currentStep) {
      this.currentStep = step;
      this.scrollToTop();
    }
  }

  nextStep(): void {
    if (this.validateStep(this.currentStep) && this.currentStep < this.steps.length) {
      this.currentStep += 1;
      this.scrollToTop();
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep -= 1;
      this.scrollToTop();
    }
  }

  handleFileSelected(selection: { key: OwnerFileKey; file: File }): void {
    this.files[selection.key] = selection.file;
  }

  removeFile(key: OwnerFileKey): void {
    this.files[key] = null;
  }

  handleFormSubmit(): void {
    if (this.currentStep < this.steps.length) {
      this.nextStep();
      return;
    }

    this.submit();
  }

  @HostListener('document:keydown.enter', ['$event'])
  handleEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    const target = keyboardEvent.target as HTMLElement | null;
    const interactiveTags = ['BUTTON', 'A', 'SELECT', 'TEXTAREA'];

    if (
      this.submitting ||
      keyboardEvent.repeat ||
      target?.isContentEditable ||
      (target && interactiveTags.includes(target.tagName))
    ) return;

    keyboardEvent.preventDefault();
    this.handleFormSubmit();
  }

  submit(): void {
    if (this.submitting || !this.validateAllSteps()) return;
    this.submitting = true;

    const request = Object.fromEntries(
      Object.entries(this.form).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
    );

    this.submitApplication.execute(request, {
      idCardFront: this.files.idCardFront!,
      idCardBack: this.files.idCardBack!,
      businessLicense: this.files.businessLicense!,
      venueImage: this.files.venueImage!
    }).subscribe({
      next: applications => {
        this.submitting = false;
        this.form = createOwnerApplicationForm();
        this.files = createOwnerApplicationFiles();
        this.currentStep = 1;
        this.notify.success('Đã nộp đơn đăng ký chủ sân thành công.');
        this.submitted.emit(applications);
      },
      error: error => {
        console.error('Failed to submit owner application:', error);
        this.submitting = false;
        this.notify.error(error?.error?.message || 'Đã xảy ra lỗi khi gửi đơn đăng ký.');
      }
    });
  }

  private validateAllSteps(): boolean {
    const result = OwnerApplicationValidator.validateAll(this.form, this.files);
    if (result.valid) return true;
    this.currentStep = result.firstInvalidStep;
    this.notify.warning(Object.values(result.errors)[0] ?? 'Vui lòng kiểm tra lại thông tin.');
    this.scrollToTop();
    return false;
  }

  private validateStep(step: number): boolean {
    const errors = OwnerApplicationValidator.validateStep(step, this.form, this.files);
    const firstError = Object.values(errors)[0];
    if (!firstError) return true;
    this.notify.warning(firstError);
    return false;
  }

  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
