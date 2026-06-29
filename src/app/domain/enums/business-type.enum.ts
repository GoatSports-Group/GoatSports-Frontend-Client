export enum BusinessType {
  INDIVIDUAL = 'INDIVIDUAL',
  COMPANY = 'COMPANY',
}

export const BUSINESS_TYPE_OPTIONS = [
  {
    value: BusinessType.INDIVIDUAL,
    label: 'Cá nhân',
  },
  {
    value: BusinessType.COMPANY,
    label: 'Doanh nghiệp',
  },
];