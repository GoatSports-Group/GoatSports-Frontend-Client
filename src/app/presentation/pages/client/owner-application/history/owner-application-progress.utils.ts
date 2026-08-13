import {
  BUSINESS_TYPE_OPTIONS,
  BusinessType,
  OwnerApplication,
  OWNER_APPLICATION_STATUS_OPTIONS,
  OwnerApplicationStatus
} from '@application/dto/owner-application/owner-application.dto';
import {
  OwnerApplicationProgress,
  OwnerApplicationProgressState,
  OwnerApplicationProgressStep
} from './owner-application-progress.models';

const STEP_TITLES = [
  'Chủ sân nộp đơn',
  'Quản trị nhận đơn',
  'Quản trị xem đơn',
  'Xử lý đơn'
] as const;

export function buildOwnerApplicationProgress(
  application: OwnerApplication
): OwnerApplicationProgress {
  const hasReviewer = Boolean(application.reviewerId);

  if (application.status === OwnerApplicationStatus.APPROVED) {
    return createFinalProgress(application, 'approved', 'Hồ sơ đã được phê duyệt', 'Đơn đăng ký đã được chấp nhận.');
  }

  if (application.status === OwnerApplicationStatus.REJECTED) {
    return createFinalProgress(application, 'rejected', 'Hồ sơ chưa được phê duyệt', 'Đơn đăng ký đã bị từ chối.');
  }

  if (application.status === OwnerApplicationStatus.CANCELLED) {
    return {
      summary: 'Hồ sơ đã được hủy',
      tone: 'cancelled',
      steps: [
        createStep(0, 'completed', 'Hồ sơ đã được gửi thành công.', application.createdAt),
        createStep(1, 'upcoming', 'Chưa tiếp nhận hồ sơ.'),
        createStep(2, 'upcoming', 'Chưa xem hồ sơ.'),
        createStep(3, 'cancelled', 'Quy trình xử lý đã dừng.')
      ]
    };
  }

  return {
    summary: hasReviewer ? 'Quản trị đang xử lý hồ sơ' : 'Quản trị đã nhận được hồ sơ',
    tone: 'pending',
    steps: [
      createStep(0, 'completed', 'Hồ sơ đã được gửi thành công.', application.createdAt),
      createStep(1, 'completed', 'Hồ sơ đã vào hàng đợi xử lý.', application.createdAt),
      createStep(
        2,
        hasReviewer ? 'completed' : 'current',
        hasReviewer ? 'Quản trị đã mở và kiểm tra hồ sơ.' : 'Đang chờ quản trị kiểm tra chi tiết.'
      ),
      createStep(
        3,
        hasReviewer ? 'current' : 'upcoming',
        hasReviewer ? 'Đang xác minh và đưa ra kết quả.' : 'Chưa bắt đầu xử lý.'
      )
    ]
  };
}

export function getOwnerApplicationStatusLabel(status: OwnerApplicationStatus): string {
  return OWNER_APPLICATION_STATUS_OPTIONS.find(option => option.value === status)?.label ?? status;
}

export function getBusinessTypeLabel(type: BusinessType): string {
  return BUSINESS_TYPE_OPTIONS.find(option => option.value === type)?.label ?? type;
}

export function formatOwnerApplicationAddress(application: OwnerApplication): string {
  const address = application.address;
  return [address.address, address.ward, address.district, address.city, address.province]
    .map(part => part?.trim())
    .filter((part): part is string => Boolean(part))
    .filter((part, index, parts) => parts.indexOf(part) === index)
    .join(', ');
}

function createFinalProgress(
  application: OwnerApplication,
  finalState: 'approved' | 'rejected',
  summary: string,
  finalDescription: string
): OwnerApplicationProgress {
  return {
    summary,
    tone: finalState,
    steps: [
      createStep(0, 'completed', 'Hồ sơ đã được gửi thành công.', application.createdAt),
      createStep(1, 'completed', 'Hồ sơ đã được quản trị tiếp nhận.', application.createdAt),
      createStep(2, 'completed', 'Quản trị đã kiểm tra hồ sơ.'),
      createStep(
        3,
        finalState === 'approved' ? 'completed' : 'rejected',
        finalDescription,
        application.reviewedAt
      )
    ]
  };
}

function createStep(
  index: number,
  state: OwnerApplicationProgressState,
  description: string,
  timestamp?: string
): OwnerApplicationProgressStep {
  return { title: STEP_TITLES[index], description, state, timestamp };
}
