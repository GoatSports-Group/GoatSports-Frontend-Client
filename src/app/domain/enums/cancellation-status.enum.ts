export enum CancellationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REFUND_PROCESSING = 'REFUND_PROCESSING',
  REFUND_COMPLETED = 'REFUND_COMPLETED',
}

export const CANCELLATION_STATUS_LABELS: Record<CancellationStatus, string> = {
  [CancellationStatus.PENDING]: 'Chờ xử lý',
  [CancellationStatus.APPROVED]: 'Đã chấp thuận',
  [CancellationStatus.REJECTED]: 'Bị từ chối',
  [CancellationStatus.REFUND_PROCESSING]: 'Đang hoàn tiền',
  [CancellationStatus.REFUND_COMPLETED]: 'Đã hoàn tiền',
};
