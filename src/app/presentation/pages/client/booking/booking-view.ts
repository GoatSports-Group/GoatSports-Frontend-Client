import { Booking, BookingStatus, CancellationStatus } from '@application/dto/booking/booking.dto';

/** Cap mau trang thai (GOAT-DESIGN §3 Status tones): chu tren nen -soft cua chinh no. */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const BOOKING_TONE: Record<BookingStatus, Tone> = {
  [BookingStatus.PENDING_PAYMENT]: 'warning',
  [BookingStatus.CONFIRMED]: 'success',
  [BookingStatus.CHECKED_IN]: 'info',
  [BookingStatus.COMPLETED]: 'neutral',
  [BookingStatus.CANCELLED]: 'danger',
  [BookingStatus.REFUND_PENDING]: 'warning',
  [BookingStatus.REFUNDED]: 'info',
  [BookingStatus.EXPIRED]: 'neutral',
  [BookingStatus.NO_SHOW]: 'neutral'
};

export const CANCELLATION_TONE: Record<CancellationStatus, Tone> = {
  [CancellationStatus.PENDING]: 'warning',
  [CancellationStatus.APPROVED]: 'info',
  [CancellationStatus.REJECTED]: 'danger',
  [CancellationStatus.REFUND_AWAITING_CLAIM]: 'warning',
  [CancellationStatus.REFUND_AWAITING_BANK_ACCOUNT]: 'warning',
  [CancellationStatus.REFUND_PROCESSING]: 'info',
  [CancellationStatus.REFUND_MANUAL_REVIEW]: 'info',
  [CancellationStatus.REFUNDED]: 'success',
  [CancellationStatus.REFUND_FAILED]: 'danger'
};

/** Luot dat con hieu luc (chua choi xong, chua huy): cuong ngay to mau xanh. */
export function isActiveBooking(booking: Booking): boolean {
  return [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN].includes(booking.status);
}

/** Ngay choi yyyy-MM-dd -> Date dia phuong (khong lech mui gio). */
export function playDay(booking: Booking): Date {
  const [year, month, day] = booking.playDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function startsAt(booking: Booking): Date {
  return new Date(`${booking.playDate}T${booking.startTime}`);
}

export function weekdayLabel(date: Date): string {
  const label = new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "60 phút" / "1 giờ 30 phút" tu gio bat dau - ket thuc. */
export function durationLabel(booking: Booking): string {
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  };
  const minutes = toMinutes(booking.endTime) - toMinutes(booking.startTime);
  if (minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} phút`;
  return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
}

/** Con bao lau toi tran (chi cho luot con hieu luc): "Hôm nay", "Ngày mai", "Còn 3 ngày". */
export function countdownLabel(booking: Booking, now = new Date()): string {
  if (!isActiveBooking(booking)) return '';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.round((playDay(booking).getTime() - today) / 86_400_000);
  if (days < 0) return '';
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Ngày mai';
  return days <= 30 ? `Còn ${days} ngày` : '';
}

export function formatPrice(price: number | null | undefined): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price ?? 0);
}
