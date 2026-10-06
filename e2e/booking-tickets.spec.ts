import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

// Ve dat san cua toi + chi tiet ve, lam lai theo GOAT-DESIGN: tab gach chan co so dem, the ve (cuong ngay),
// mau trang thai theo bo tone chuan, chi tiet: the ve QR | lich choi, ba o tien, cot phai.
const ok = (data: unknown) => ({ json: { data, statusCode: 200, message: null, error: null } });
const VENUE = '17397670-2693-30f3-8188-baf3469fe5ec';
const OWNER = '33333333-3333-4333-8333-333333333333';

function day(offset: number): string {
  const value = new Date(Date.now() + offset * 86_400_000);
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
}

const base = {
  venueCourtId: 'c1', venueId: VENUE, venueName: 'Sân Thể Thao Bình Thạnh', courtName: 'Sân số 2 (7 người)',
  startTime: '19:00:00', endTime: '20:30:00', totalPrice: 450000, depositAmount: 135000, remainingAmount: 315000,
  createdAt: '2026-09-20T10:00:00', cancellationPolicy: { fullRefundHoursBefore: 24, partialRefundHoursBefore: 6, partialRefundPercentage: 50 }
};
const upcoming = { ...base, bookingId: 'b1', bookingCode: 'GSLV8ZUP', playDate: day(2), status: 'CONFIRMED', qrCode: 'GOAT-QR-GSLV8ZUP' };
const cancelled = {
  ...base, bookingId: 'b2', bookingCode: 'GSQHOOQ6', playDate: day(-5), status: 'CANCELLED',
  cancellation: { cancellationId: 'x2', bookingId: 'b2', requestedByUserId: 'me', reason: 'Trùng lịch công ty', refundPercentage: 0,
    refundAmount: 0, status: 'APPROVED', reviewMode: 'OWNER_REVIEW', createdAt: '2026-09-21T08:00:00', processedAt: '2026-09-21T09:00:00' }
};
const refunded = {
  ...base, bookingId: 'b3', bookingCode: 'GSZUXCRC', playDate: day(-9), status: 'REFUNDED',
  cancellation: { cancellationId: 'x3', bookingId: 'b3', requestedByUserId: 'me', reason: 'Trời mưa', refundPercentage: 100,
    refundAmount: 135000, status: 'REFUNDED', reviewMode: 'AUTOMATIC', refundId: 'rf-1', createdAt: '2026-09-18T08:00:00',
    processedAt: '2026-09-18T08:00:01' }
};
// Da coc, het gio choi ma chua quet QR: server da chuyen sang NO_SHOW.
const noShow = { ...base, bookingId: 'b4', bookingCode: 'GSLEOQDJ', playDate: day(-4), status: 'NO_SHOW', qrCode: 'GOAT-QR-GSLEOQDJ' };
const all = [upcoming, cancelled, refunded, noShow];

async function mockBookings(page: Page): Promise<URLSearchParams[]> {
  await mockGoatSportsApi(page);
  const queries: URLSearchParams[] = [];
  await page.route(url => url.pathname.endsWith('/bookings/my-history'), route => {
    const params = new URL(route.request().url()).searchParams;
    queries.push(params);
    const status = params.get('status');
    // UPCOMING: con hieu luc va chua toi ngay choi (nhu server loc theo gio choi).
    const items = all.filter(item => !status
      || (status === 'UPCOMING' ? ['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'].includes(item.status) && item.playDate >= day(0)
        : item.status === status));
    const size = Number(params.get('size'));
    return route.fulfill(ok({ meta: { page: 0, pageSize: size, pages: 1, total: items.length }, result: items.slice(0, size) }));
  });
  await page.route(url => /\/bookings\/b\d$/.test(url.pathname), route =>
    route.fulfill(ok(all.find(item => route.request().url().includes(`/bookings/${item.bookingId}`)))));
  await page.route(`**/venue-service/api/v1/venues/${VENUE}`, route => route.fulfill(ok({
    venueId: VENUE, ownerId: OWNER, name: 'Sân Thể Thao Bình Thạnh', imageUrls: [], amenities: [], sportTypes: [], courts: []
  })));
  return queries;
}

test('vé đặt sân: tab gạch chân có số đếm, thẻ vé có cuống ngày và màu trạng thái chuẩn', async ({ page }) => {
  const queries = await mockBookings(page);
  await page.goto('/booking/history');
  await expect(page.getByRole('heading', { name: 'Vé đặt sân của tôi', level: 1 })).toBeVisible();

  const tabs = page.getByRole('tablist', { name: 'Lọc vé theo trạng thái' });
  await expect(tabs.getByRole('tab', { name: /Tất cả\s*4/ })).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.getByRole('tab', { name: /Sắp diễn ra\s*1/ })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: /Không đến\s*1/ })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: /Đã hủy\s*1/ })).toBeVisible();

  const tickets = page.locator('.ticket');
  await expect(tickets).toHaveCount(4);
  await expect(tickets.filter({ hasText: 'GSLEOQDJ' }).locator('.ticket__money')).toContainText('Không đến · mất cọc');
  await expect(tickets.filter({ hasText: 'GSLEOQDJ' })).not.toHaveClass(/is-active/);
  const soon = tickets.filter({ hasText: 'GSLV8ZUP' });
  await expect(soon).toHaveClass(/is-active/);
  await expect(soon.locator('.badge--success')).toHaveText('Đã xác nhận');
  await expect(soon).toContainText('19:00 – 20:30');
  await expect(soon).toContainText('Còn 2 ngày');
  // Huy duoc chap thuan nhung 0 dong: noi ro "Không hoàn cọc", khong phai "0 ₫".
  await expect(tickets.filter({ hasText: 'GSQHOOQ6' }).locator('.ticket__money')).toHaveText('Đã hủy · không hoàn cọc');
  await expect(tickets.filter({ hasText: 'GSZUXCRC' }).locator('.ticket__money.is-success')).toContainText('135.000');

  // "Sap dien ra" hoi server theo gio choi (UPCOMING), khong theo trang thai CONFIRMED.
  await tabs.getByRole('tab', { name: /Sắp diễn ra/ }).click();
  await expect(tickets).toHaveCount(1);
  expect(queries.some(params => params.get('status') === 'UPCOMING' && params.get('size') === '12')).toBe(true);

  await tabs.getByRole('tab', { name: /Đã hủy/ }).click();
  await expect(tickets).toHaveCount(1);
  expect(queries.some(params => params.get('status') === 'CANCELLED' && params.get('size') === '12')).toBe(true);

  const results = await new AxeBuilder({ page }).include('main.tickets').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.map(item => item.id)).toEqual([]);
});

test('chi tiết vé còn hiệu lực: QR, lịch chơi, ba ô tiền, chính sách đánh dấu mức hiện tại, nhắn tin chủ sân', async ({ page }) => {
  await mockBookings(page);
  await page.goto('/booking/detail/b1');
  await expect(page.getByRole('heading', { name: 'Sân Thể Thao Bình Thạnh', level: 1 })).toBeVisible();
  await expect(page.locator('.pass app-qr-code')).toBeVisible();
  await expect(page.locator('.pass__when')).toContainText('19:00 – 20:30');
  await expect(page.locator('.pass__when')).toContainText('1 giờ 30 phút');
  await expect(page.locator('.pass__money')).toContainText('450.000');
  await expect(page.locator('.pass__money')).toContainText('315.000');
  // Con 2 ngay (>24 gio): muc "Hoan 100%" dang ap dung.
  await expect(page.locator('.policy li.is-now')).toContainText('Hoàn 100%');
  await expect(page.getByRole('button', { name: 'Nhắn tin chủ sân' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Yêu cầu hủy sân' })).toBeVisible();

  const results = await new AxeBuilder({ page }).include('main.ticket-page').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.map(item => item.id)).toEqual([]);
});

test('chi tiết vé đã hủy: thay QR bằng lời giải thích, tiến độ hủy ở cột phải', async ({ page }) => {
  await mockBookings(page);
  await page.goto('/booking/detail/b2');
  await expect(page.locator('.pass__note.is-danger')).toContainText('Vé đã hủy');
  await expect(page.locator('.pass app-qr-code')).toHaveCount(0);
  await expect(page.locator('.refund')).toContainText('Không hoàn cọc');
  await expect(page.locator('.steps li.is-done')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Yêu cầu hủy sân' })).toHaveCount(0);
});

test('chi tiết vé không đến: giải thích mất cọc thay cho QR, không thu khoản còn lại', async ({ page }) => {
  await mockBookings(page);
  await page.goto('/booking/detail/b4');
  await expect(page.locator('.identity .badge')).toHaveText('Không đến');
  await expect(page.locator('.pass__note')).toContainText('Bạn không đến nhận sân');
  await expect(page.locator('.pass app-qr-code')).toHaveCount(0);
  await expect(page.locator('.pass__money')).toContainText('Không thu');
  await expect(page.getByRole('button', { name: 'Yêu cầu hủy sân' })).toHaveCount(0);
});
