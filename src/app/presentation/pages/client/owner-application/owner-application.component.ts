import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { SubmitOwnerApplicationUseCase } from '@application/usecase/owner-application/submit-owner-application.usecase';
import { GetMyOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-my-owner-applications.usecase';
import { OwnerApplication, OwnerApplicationStatus, OWNER_APPLICATION_STATUS_OPTIONS, BusinessType, BUSINESS_TYPE_OPTIONS } from '@application/dto/owner-application/owner-application.dto';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NotificationService } from '@presentation/services/notification.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-owner-application',
    templateUrl: './owner-application.component.html',
    styleUrls: ['./owner-application.component.scss'],
    standalone: false
})
export class OwnerApplicationComponent implements OnInit, OnDestroy {
  private submitUseCase = inject(SubmitOwnerApplicationUseCase);
  private getMyApplicationsUseCase = inject(GetMyOwnerApplicationsUseCase);
  private snackBar = inject(MatSnackBar);
  private notificationService = inject(NotificationService);

  private notificationSub?: Subscription;

  activeTab: 'list' | 'form' = 'list';
  applications: OwnerApplication[] = [];
  loading = false;
  submitting = false;
  readonly BUSINESS_TYPE_OPTIONS = BUSINESS_TYPE_OPTIONS;

  form = {
    fullName: '',
    phone: '',
    email: '',
    identityNumber: '',
    businessName: '',
    businessType: BusinessType.INDIVIDUAL,
    taxCode: '',
    address: '',
    province: '',
    district: '',
    ward: '',
    city: ''
  };

  files: {
    idCardFront: File | null;
    idCardBack: File | null;
    businessLicense: File | null;
    venueImage: File | null;
  } = {
      idCardFront: null,
      idCardBack: null,
      businessLicense: null,
      venueImage: null
    };

  fileNames = {
    idCardFront: '',
    idCardBack: '',
    businessLicense: '',
    venueImage: ''
  };



  ngOnInit() {
    this.loadApplications();
    this.listenToNotifications();
  }

  listenToNotifications() {
    this.notificationSub = this.notificationService.notifications$.subscribe({
      next: () => {
        // Sau 1s kể từ khi nhận được thông báo, cập nhật lại trạng thái đơn đăng ký
        setTimeout(() => {
          this.loadApplications();
        }, 1000);
      }
    });
  }

  ngOnDestroy() {
    if (this.notificationSub) {
      this.notificationSub.unsubscribe();
    }
  }

  loadApplications() {
    this.loading = true;
    this.getMyApplicationsUseCase.execute().subscribe({
      next: (data) => {
        this.applications = data;
        this.loading = false;
        if (data.length === 0) {
          this.activeTab = 'form';
        }
      },
      error: (err) => {
        console.error(err);
        this.snackBar.open('Không thể tải danh sách đơn đăng ký!', 'Đóng', {
          duration: 4000,
          panelClass: ['snackbar-error']
        });
        this.loading = false;
      }
    });
  }

  onFileSelected(event: any, key: 'idCardFront' | 'idCardBack' | 'businessLicense' | 'venueImage') {
    const file: File = event.target.files[0];
    if (file) {
      this.files[key] = file;
      this.fileNames[key] = file.name;
    }
  }

  onSubmit() {
    if (this.submitting) return;

    // Validate required fields
    if (
      !this.form.fullName ||
      !this.form.phone ||
      !this.form.email ||
      !this.form.identityNumber ||
      !this.form.businessName ||
      !this.form.taxCode ||
      !this.form.address ||
      !this.form.province ||
      !this.form.district ||
      !this.form.ward ||
      !this.form.city
    ) {
      this.snackBar.open('Vui lòng điền đầy đủ tất cả các trường thông tin bắt buộc!', 'Đóng', {
        duration: 4000
      });
      return;
    }

    // Validate mandatory documents
    if (!this.files.idCardFront || !this.files.idCardBack) {
      this.snackBar.open('Vui lòng tải lên cả CCCD mặt trước và mặt sau!', 'Đóng', {
        duration: 4000
      });
      return;
    }

    this.submitting = true;

    const appRequest = {
      fullName: this.form.fullName,
      phone: this.form.phone,
      email: this.form.email,
      identityNumber: this.form.identityNumber,
      businessName: this.form.businessName,
      businessType: this.form.businessType,
      taxCode: this.form.taxCode,
      address: this.form.address,
      province: this.form.province,
      district: this.form.district,
      ward: this.form.ward,
      city: this.form.city
    };

    const files = {
      idCardFront: this.files.idCardFront!,
      idCardBack: this.files.idCardBack!,
      businessLicense: this.files.businessLicense!,
      venueImage: this.files.venueImage!
    };

    this.submitUseCase.execute(appRequest, files).subscribe({
      next: (data) => {
        this.snackBar.open('Đã nộp đơn đăng ký chủ sân thành công! Vui lòng chờ Admin xác nhận.', 'Đóng', {
          duration: 5000,
          panelClass: ['snackbar-success']
        });
        this.submitting = false;
        this.resetForm();
        this.applications = data;
        this.activeTab = 'list';
      },
      error: (err) => {
        console.error(err);
        const errMsg = err.error?.message || 'Đã xảy ra lỗi khi gửi đơn đăng ký.';
        this.snackBar.open(errMsg, 'Đóng', {
          duration: 5000,
          panelClass: ['snackbar-error']
        });
        this.submitting = false;
      }
    });
  }

  resetForm() {
    this.form = {
      fullName: '',
      phone: '',
      email: '',
      identityNumber: '',
      businessName: '',
      businessType: BusinessType.INDIVIDUAL,
      taxCode: '',
      address: '',
      province: '',
      district: '',
      ward: '',
      city: ''
    };
    this.files = {
      idCardFront: null,
      idCardBack: null,
      businessLicense: null,
      venueImage: null
    };
    this.fileNames = {
      idCardFront: '',
      idCardBack: '',
      businessLicense: '',
      venueImage: ''
    };
  }

  getStatusClass(status: OwnerApplicationStatus): string {
    switch (status) {
      case OwnerApplicationStatus.PENDING:
        return OwnerApplicationStatus.PENDING;
      case OwnerApplicationStatus.APPROVED:
        return OwnerApplicationStatus.APPROVED;
      case OwnerApplicationStatus.REJECTED:
        return OwnerApplicationStatus.REJECTED;
      case OwnerApplicationStatus.CANCELLED:
        return OwnerApplicationStatus.CANCELLED;
      default:
        return '';
    }
  }

  getBusinessTypeLabel(type: BusinessType): string {
    return BUSINESS_TYPE_OPTIONS.find(o => o.value === type)?.label || type;
  }

  getStatusLabel(status: OwnerApplicationStatus): string {
    return OWNER_APPLICATION_STATUS_OPTIONS.find(o => o.value === status)?.label || status;
  }
}
