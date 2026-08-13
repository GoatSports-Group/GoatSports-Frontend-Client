import {
  OwnerApplicationFiles,
  OwnerApplicationFormValue,
  OwnerFileKey
} from '../owner-application.models';

export type OwnerFormField = keyof OwnerApplicationFormValue | OwnerFileKey;
export type OwnerValidationErrors = Partial<Record<OwnerFormField, string>>;

export interface OwnerValidationResult {
  valid: boolean;
  errors: OwnerValidationErrors;
  firstInvalidStep: number;
}

export class OwnerApplicationValidator {
  static validateStep(
    step: number,
    form: OwnerApplicationFormValue,
    files: OwnerApplicationFiles
  ): OwnerValidationErrors {
    switch (step) {
      case 1: return this.validateRepresentative(form);
      case 2: return this.validateBusiness(form);
      case 3: return this.validateAddress(form);
      case 4: return this.validateDocuments(files);
      default: return {};
    }
  }

  static validateAll(
    form: OwnerApplicationFormValue,
    files: OwnerApplicationFiles
  ): OwnerValidationResult {
    let firstInvalidStep = 0;
    const errors: OwnerValidationErrors = {};

    for (let step = 1; step <= 4; step += 1) {
      const stepErrors = this.validateStep(step, form, files);
      if (!firstInvalidStep && Object.keys(stepErrors).length) firstInvalidStep = step;
      Object.assign(errors, stepErrors);
    }

    return { valid: firstInvalidStep === 0, errors, firstInvalidStep };
  }

  private static validateRepresentative(form: OwnerApplicationFormValue): OwnerValidationErrors {
    const errors: OwnerValidationErrors = {};
    if (form.fullName.trim().length < 2) errors.fullName = 'Họ và tên phải có ít nhất 2 ký tự.';

    const phone = form.phone.replace(/[\s.-]/g, '');
    if (!/^(0\d{9}|\+84\d{9})$/.test(phone)) errors.phone = 'Số điện thoại không đúng định dạng.';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Email không đúng định dạng.';
    }

    if (!/^[A-Za-z0-9]{6,12}$/.test(form.identityNumber.trim())) {
      errors.identityNumber = 'CCCD / Hộ chiếu gồm 6–12 ký tự.';
    }
    return errors;
  }

  private static validateBusiness(form: OwnerApplicationFormValue): OwnerValidationErrors {
    const errors: OwnerValidationErrors = {};
    if (form.businessName.trim().length < 2) errors.businessName = 'Vui lòng nhập tên doanh nghiệp / cơ sở.';
    if (!form.businessType) errors.businessType = 'Vui lòng chọn loại hình kinh doanh.';
    if (!/^(\d{10}|\d{13})$/.test(form.taxCode.trim())) errors.taxCode = 'Mã số thuế phải gồm 10 hoặc 13 chữ số.';
    return errors;
  }

  private static validateAddress(form: OwnerApplicationFormValue): OwnerValidationErrors {
    const errors: OwnerValidationErrors = {};
    if (form.address.trim().length < 3) errors.address = 'Vui lòng nhập địa chỉ chi tiết.';
    if (!form.ward.trim()) errors.ward = 'Vui lòng nhập phường / xã.';
    if (!form.district.trim()) errors.district = 'Vui lòng nhập quận / huyện.';
    if (!form.province.trim()) errors.province = 'Vui lòng nhập tỉnh / thành phố.';
    if (!form.city.trim()) errors.city = 'Vui lòng nhập thành phố.';
    return errors;
  }

  private static validateDocuments(files: OwnerApplicationFiles): OwnerValidationErrors {
    const errors: OwnerValidationErrors = {};
    const labels: Record<OwnerFileKey, string> = {
      idCardFront: 'CCCD mặt trước',
      idCardBack: 'CCCD mặt sau',
      businessLicense: 'Giấy phép kinh doanh',
      venueImage: 'Hình ảnh cơ sở / sân'
    };

    (Object.keys(labels) as OwnerFileKey[]).forEach(key => {
      const file = files[key];
      if (!file) errors[key] = `Vui lòng tải lên ${labels[key]}.`;
      else if (file.size > 2 * 1024 * 1024) errors[key] = `${labels[key]} không được vượt quá 2MB.`;
    });
    return errors;
  }
}
