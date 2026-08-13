import { BusinessType } from '@application/dto/owner-application/owner-application.dto';

export interface OwnerApplicationFormValue {
  fullName: string;
  phone: string;
  email: string;
  identityNumber: string;
  businessName: string;
  businessType: BusinessType;
  taxCode: string;
  address: string;
  province: string;
  district: string;
  ward: string;
  city: string;
}

export type OwnerFileKey = 'idCardFront' | 'idCardBack' | 'businessLicense' | 'venueImage';
export type OwnerApplicationFiles = Record<OwnerFileKey, File | null>;

export interface OwnerStep {
  number: number;
  title: string;
  description: string;
}

export function createOwnerApplicationForm(): OwnerApplicationFormValue {
  return {
    fullName: '', phone: '', email: '', identityNumber: '',
    businessName: '', businessType: BusinessType.INDIVIDUAL, taxCode: '',
    address: '', province: '', district: '', ward: '', city: ''
  };
}

export function createOwnerApplicationFiles(): OwnerApplicationFiles {
  return { idCardFront: null, idCardBack: null, businessLicense: null, venueImage: null };
}
