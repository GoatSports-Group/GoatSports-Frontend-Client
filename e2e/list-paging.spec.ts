import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

// Danh sach dang luong (danh gia san) cuon vo han; danh sach tra cuu (lich su dat san) dung app-pagination.
const ok = (data: unknown) => ({ data, statusCode: 200, message: null, error: null });
const venueId = '17397670-2693-30f3-8188-baf3469fe5ec';

test('đánh giá sân tải trang tiếp khi cuộn tới cuối', async ({ page }) => {
  const requestedPages: number[] = [];
  await mockGoatSportsApi(page);
  await page.route(`**/venue-service/api/v1/venues/${venueId}`, route => route.fulfill({ json: ok({
    venueId, name: 'Sân thể thao Bình Thạnh', address: '121 Đinh Bộ Lĩnh', city: 'TP. Hồ Chí Minh',
    openTime: '06:00:00', closeTime: '22:00:00', active: true, minPrice: 150000, maxPrice: 200000,
    averageRating: 4.5, totalReviews: 22, latitude: 10.8, longitude: 106.71,
    imageUrls: [], amenities: [], sportTypes: [], courts: []
  }) }));
  await page.route(`**/venues/${venueId}/reviews**`, route => {
    const url = new URL(route.request().url());
    const index = Number(url.searchParams.get('page'));
    const size = Number(url.searchParams.get('size'));
    requestedPages.push(index);
    const count = Math.max(0, Math.min(size, 22 - index * size));
    return route.fulfill({ json: ok({
      items: Array.from({ length: count }, (_, i) => ({
        reviewId: `r-${index}-${i}`, rating: 5, content: `Nhận xét số ${index * size + i + 1}`, createdAt: '2026-09-01T10:00:00'
      })),
      total: 22, page: index, pageSize: size, totalPages: Math.ceil(22 / size)
    }) });
  });

  await page.goto(`/venues/${venueId}`);
  await page.getByRole('button', { name: /Đánh giá \(22\)/ }).click();
  await expect(page.getByText('Nhận xét số 1', { exact: true })).toBeVisible();
  await expect(page.locator('.review-card')).toHaveCount(10);

  // Danh sach cuon trong khung rieng: chua cuon thi khong tai them, trang khong dai ra.
  const list = page.locator('.review-list');
  await page.waitForTimeout(800);
  expect(requestedPages).toEqual([0]);
  expect((await list.boundingBox())!.height).toBeLessThanOrEqual(520);

  // Cuon toi day khung: trang 2 roi trang 3 duoc noi vao, khong co nut "Xem thêm".
  await list.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 8 && (await page.locator('.review-card').count()) < 22; attempt++) {
    await list.evaluate(element => element.scrollTo({ top: element.scrollHeight }));
    await page.waitForTimeout(300);
  }
  await expect(page.locator('.review-card')).toHaveCount(22);
  await expect(page.getByText('Nhận xét số 22', { exact: true })).toBeVisible();
  expect(requestedPages).toEqual([0, 1, 2]);
  await expect(page.locator('.reviews-panel .list-sentinel')).toHaveCount(0);
});

test('lịch sử đặt sân phân trang bằng app-pagination', async ({ page }) => {
  await mockGoatSportsApi(page);
  await page.route('**/venue-service/api/v1/bookings/my-history**', route => {
    const index = Number(new URL(route.request().url()).searchParams.get('page'));
    const result = Array.from({ length: index === 0 ? 12 : 3 }, (_, i) => ({
      bookingId: `b-${index}-${i}`, venueId, venueCourtId: 'c1', playDate: '2026-10-10', startTime: '18:00:00', endTime: '19:30:00',
      status: 'CONFIRMED', totalPrice: 300000, depositAmount: 90000, remainingAmount: 210000, bookingCode: `GS${index}${i}`,
      createdAt: '2026-10-01T10:00:00', venueName: `Cơ sở ${index * 12 + i + 1}`, courtName: 'Sân 2'
    }));
    return route.fulfill({ json: ok({ meta: { page: index, pageSize: 12, pages: 2, total: 15 }, result }) });
  });

  await page.goto('/booking/history');
  await expect(page.getByText('Cơ sở 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xem thêm' })).toHaveCount(0);
  const pager = page.locator('app-pagination');
  await expect(pager).toContainText('Hiển thị 1 - 12 trong tổng số 15 vé');

  await pager.getByRole('button', { name: 'Trang 2' }).click();
  await expect(page.getByText('Cơ sở 13', { exact: true })).toBeVisible();
  await expect(page.getByText('Cơ sở 1', { exact: true })).toHaveCount(0);
  await expect(pager).toContainText('Hiển thị 13 - 15 trong tổng số 15 vé');
});
