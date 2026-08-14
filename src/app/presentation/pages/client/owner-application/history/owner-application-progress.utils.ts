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
  const hasBeenViewed = Boolean(application.viewedAt);
  const hasBeenReceived = Boolean(application.receivedAt || hasBeenViewed);

  if (application.status === OwnerApplicationStatus.APPROVED) {
    return createFinalProgress(application, 'approved', 'Hồ sơ đã được phê duyệt', 'Đơn đăng ký đã được chấp nhận.');
  }

  if (application.status === OwnerApplicationStatus.REJECTED) {
    return createFinalProgress(application, 'rejected', 'Hồ sơ chưa được phê duyệt', 'Đơn đăng ký đã bị từ chối.');
  }

  if (application.status === OwnerApplicationStatus.CANCELLED) {
    return {
      summary: 'Hồ sơ đã được hủy',
      detail: 'Quy trình xử lý hồ sơ đã dừng.',
      updatedAt: application.reviewedAt ?? application.createdAt,
      tone: 'cancelled',
      steps: [
        createStep(0, 'completed', 'Hồ sơ đã được gửi thành công.', application.createdAt),
        createStep(
          1,
          hasBeenReceived ? 'completed' : 'upcoming',
          hasBeenReceived ? 'Thông báo hồ sơ đã được gửi đến quản trị.' : 'Chưa tiếp nhận hồ sơ.',
          application.receivedAt
        ),
        createStep(
          2,
          hasBeenViewed ? 'completed' : 'upcoming',
          hasBeenViewed ? 'Quản trị đã mở hồ sơ.' : 'Chưa xem hồ sơ.',
          application.viewedAt
        ),
        createStep(3, 'cancelled', 'Quy trình xử lý đã dừng.')
      ]
    };
  }

  return {
    summary: hasBeenViewed
      ? 'Quản trị đã xem hồ sơ'
      : hasBeenReceived
        ? 'Quản trị đã nhận được hồ sơ'
        : 'Hồ sơ đang được chuyển đến quản trị',
    detail: hasBeenViewed
      ? 'Hồ sơ đang chờ quản trị đưa ra kết quả.'
      : hasBeenReceived
        ? 'Hồ sơ đang chờ quản trị kiểm tra chi tiết.'
        : 'Hệ thống đang chuyển hồ sơ vào hàng đợi xử lý.',
    updatedAt: application.viewedAt ?? application.receivedAt ?? application.createdAt,
    tone: 'pending',
    steps: [
      createStep(0, 'completed', 'Hồ sơ đã được gửi thành công.', application.createdAt),
      createStep(
        1,
        hasBeenReceived ? 'completed' : 'current',
        hasBeenReceived ? 'Thông báo hồ sơ đã được gửi đến quản trị.' : 'Đang chuyển hồ sơ đến quản trị.',
        application.receivedAt
      ),
      createStep(
        2,
        hasBeenViewed ? 'completed' : hasBeenReceived ? 'current' : 'upcoming',
        hasBeenViewed ? 'Quản trị đã mở và kiểm tra hồ sơ.' : 'Đang chờ quản trị kiểm tra chi tiết.',
        application.viewedAt
      ),
      createStep(
        3,
        'upcoming',
        hasBeenViewed ? 'Đang chờ kết quả xử lý.' : 'Chưa bắt đầu xử lý.'
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
    detail: finalDescription,
    updatedAt: application.reviewedAt ?? application.createdAt,
    tone: finalState,
    steps: [
      createStep(0, 'completed', 'Hồ sơ đã được gửi thành công.', application.createdAt),
      createStep(
        1,
        application.receivedAt ? 'completed' : 'upcoming',
        application.receivedAt ? 'Thông báo hồ sơ đã được gửi đến quản trị.' : 'Không có dữ liệu tiếp nhận.',
        application.receivedAt
      ),
      createStep(
        2,
        application.viewedAt ? 'completed' : 'upcoming',
        application.viewedAt ? 'Quản trị đã mở và kiểm tra hồ sơ.' : 'Không có dữ liệu xem hồ sơ.',
        application.viewedAt
      ),
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
