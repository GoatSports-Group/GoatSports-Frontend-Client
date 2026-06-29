import { Component, OnInit, inject } from '@angular/core';
import { SubmitOwnerApplicationUseCase } from '@application/usecase/owner-application/submit-owner-application.usecase';
import { GetMyOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-my-owner-applications.usecase';
import { OwnerApplication, OwnerApplicationStatus, OWNER_APPLICATION_STATUS_OPTIONS, BusinessType, BUSINESS_TYPE_OPTIONS, DocumentType } from '@application/dto/owner-application/owner-application.dto';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-owner-application',
  templateUrl: './owner-application.component.html',
  styleUrls: ['./owner-application.component.scss']
})
export class OwnerApplicationComponent implements OnInit {
  private submitUseCase = inject(SubmitOwnerApplicationUseCase);
  private getMyApplicationsUseCase = inject(GetMyOwnerApplicationsUseCase);
  private snackBar = inject(MatSnackBar);

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
    const formData = new FormData();

    // Append text fields
    formData.append('fullName', this.form.fullName);
    formData.append('phone', this.form.phone);
    formData.append('email', this.form.email);
    formData.append('identityNumber', this.form.identityNumber);
    formData.append('businessName', this.form.businessName);
    formData.append('businessType', this.form.businessType);
    formData.append('taxCode', this.form.taxCode);
    formData.append('address', this.form.address);
    formData.append('province', this.form.province);
    formData.append('district', this.form.district);
    formData.append('ward', this.form.ward);
    formData.append('city', this.form.city);

    // Append documents sequentially
    let docIndex = 0;

    formData.append(`documents[${docIndex}].documentType`, DocumentType.ID_CARD_FRONT);
    formData.append(`documents[${docIndex}].fileUrl`, this.files.idCardFront);
    docIndex++;

    formData.append(`documents[${docIndex}].documentType`, DocumentType.ID_CARD_BACK);
    formData.append(`documents[${docIndex}].fileUrl`, this.files.idCardBack);
    docIndex++;

    if (this.files.businessLicense) {
      formData.append(`documents[${docIndex}].documentType`, DocumentType.BUSINESS_LICENSE);
      formData.append(`documents[${docIndex}].fileUrl`, this.files.businessLicense);
      docIndex++;
    }

    if (this.files.venueImage) {
      formData.append(`documents[${docIndex}].documentType`, DocumentType.VENUE_IMAGE);
      formData.append(`documents[${docIndex}].fileUrl`, this.files.venueImage);
      docIndex++;
    }

    this.submitUseCase.execute(formData).subscribe({
      next: (response) => {
        this.snackBar.open('Đã nộp đơn đăng ký chủ sân thành công! Vui lòng chờ Admin xác nhận.', 'Đóng', {
          duration: 5000,
          panelClass: ['snackbar-success']
        });
        this.submitting = false;
        this.resetForm();
        this.loadApplications();
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
