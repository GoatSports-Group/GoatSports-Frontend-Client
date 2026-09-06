export enum PaymentMethod {
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH',
}

export const PAYMENT_METHOD_OPTIONS = [
  { value: PaymentMethod.BANK_TRANSFER, label: 'Chuyển khoản VietQR', icon: 'qr-code' },
  { value: PaymentMethod.CASH, label: 'Thanh toán tại quầy', icon: 'receipt' },
];
