import { Page, expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

const bookingId = 'b0b0b0b0-0000-4000-8000-000000000001';
const paymentId = 'a0a0a0a0-0000-4000-8000-000000000001';

const booking = (patch: Record<string, unknown>) => ({
  bookingId, venueCourtId: 'c0c0c0c0-0000-4000-8000-000000000001', playerId: '11111111-1111-4111-8111-111111111111',
  playDate: '2026-10-02', startTime: '18:00', endTime: '19:00', totalPrice: 200000, depositAmount: 60000,
  remainingAmount: 140000, bookingCode: 'GS-7Q4K', createdAt: '2026-09-27T10:00:00', ...patch
});

/** payOS tra ve /payment/success: tien da ve (SUCCEEDED), con booking thi tuy kich ban. */
async function returnFromPayOs(page: Page, bookingState: Record<string, unknown>): Promise<void> {
  await mockGoatSportsApi(page);
  await page.addInitScript(([b, p]) => sessionStorage.setItem('goatsports.pending-booking-payment',
    JSON.stringify({ kind: 'BOOKING', bookingId: b, paymentId: p })), [bookingId, paymentId]);
  await page.route(`**/payment-service/api/v1/payments/${paymentId}`, route => route.fulfill({ json: {
    success: true, data: { paymentId, status: 'SUCCEEDED', amount: 60000, currency: 'VND' }
  } }));
  await page.route(`**/venue-service/api/v1/bookings/${bookingId}`, route => route.fulfill({ json: {
    success: true, data: booking(bookingState)
  } }));
  await page.goto('/payment/success');
}

test('tiền về sau khi hết giờ giữ sân: báo đang hoàn tiền, không báo thành công', async ({ page }) => {
  await returnFromPayOs(page, {
    status: 'EXPIRED', lateRefundPaymentId: paymentId, lateRefundAmount: 60000, lateRefundAt: '2026-09-27T10:16:05'
  });

  await expect(page.getByRole('heading', { name: 'Chưa giữ được sân, tiền đang được hoàn' })).toBeVisible();
  await expect(page.getByText('Số tiền được hoàn')).toBeVisible();
  await expect(page.getByText(/60\.000/)).toBeVisible();
  await expect(page.getByText('Khung giờ của bạn đã được xác nhận')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Theo dõi khoản hoàn' })).toHaveAttribute('href', '/settings?tab=banking');
});

test('tiền về kịp (booking đã nhận đúng khoản này): báo sân đã xác nhận', async ({ page }) => {
  await returnFromPayOs(page, { status: 'CONFIRMED', depositPaymentId: paymentId });

  await expect(page.getByRole('heading', { name: 'Khung giờ của bạn đã được xác nhận' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem vé đặt sân' })).toBeVisible();
});
