import { OwnerApplicationStatus } from '@domain/enums/owner-application-status.enum';
import { BusinessType } from '@domain/enums/business-type.enum';
import { DocumentType } from '@domain/enums/document-type.enum';

export interface OwnerApplicationAddress {
  addressId: string;
  address: string;
  ward: string;
  district: string;
  city: string;
  province: string;
}

export interface OwnerApplicationDocument {
  ownerApplicationDocumentId: string;
  documentType: DocumentType;
  fileUrl: string;
}

export interface OwnerApplication {
  ownerApplicationId: string;
  userId: string;
  fullName: string;
  phone: string;
  email: string;
  businessName: string;
  businessType: BusinessType;
  taxCode: string;
  identityNumber: string;
  status: OwnerApplicationStatus;
  rejectReason?: string;
  reviewerId?: string;
  reviewedAt?: string;
  createdAt?: string;
  address: OwnerApplicationAddress;
  documents: OwnerApplicationDocument[];
}
