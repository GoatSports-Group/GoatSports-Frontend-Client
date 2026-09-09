export enum CancellationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REFUND_AWAITING_CLAIM = 'REFUND_AWAITING_CLAIM',
  REFUND_AWAITING_BANK_ACCOUNT = 'REFUND_AWAITING_BANK_ACCOUNT',
  REFUND_PROCESSING = 'REFUND_PROCESSING',
  REFUND_MANUAL_REVIEW = 'REFUND_MANUAL_REVIEW',
  REFUNDED = 'REFUNDED',
  REFUND_FAILED = 'REFUND_FAILED',
}

export const CANCELLATION_STATUS_LABELS: Record<CancellationStatus, string> = {
  [CancellationStatus.PENDING]: 'Chờ xử lý',
  [CancellationStatus.APPROVED]: 'Đã chấp thuận',
  [CancellationStatus.REJECTED]: 'Bị từ chối',
  [CancellationStatus.REFUND_AWAITING_CLAIM]: 'Sẵn sàng nhận hoàn tiền',
  [CancellationStatus.REFUND_AWAITING_BANK_ACCOUNT]: 'Chờ liên kết ngân hàng',
  [CancellationStatus.REFUND_PROCESSING]: 'Đang hoàn tiền',
  [CancellationStatus.REFUND_MANUAL_REVIEW]: 'Chờ hoàn tiền thủ công',
  [CancellationStatus.REFUNDED]: 'Đã hoàn tiền',
  [CancellationStatus.REFUND_FAILED]: 'Cần xử lý thủ công',
};
