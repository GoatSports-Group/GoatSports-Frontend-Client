export enum CancellationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REFUND_PROCESSING = 'REFUND_PROCESSING',
  REFUNDED = 'REFUNDED',
  REFUND_FAILED = 'REFUND_FAILED',
}

export const CANCELLATION_STATUS_LABELS: Record<CancellationStatus, string> = {
  [CancellationStatus.PENDING]: 'Chờ xử lý',
  [CancellationStatus.APPROVED]: 'Đã chấp thuận',
  [CancellationStatus.REJECTED]: 'Bị từ chối',
  [CancellationStatus.REFUND_PROCESSING]: 'Đang hoàn tiền',
  [CancellationStatus.REFUNDED]: 'Đã hoàn tiền',
  [CancellationStatus.REFUND_FAILED]: 'Cần xử lý thủ công',
};
