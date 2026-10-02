import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

const ok = (data: unknown) => ({ data, statusCode: 200, message: null, error: null });
const venueId = '17397670-2693-30f3-8188-baf3469fe5ec';

function venue(id: string, name: string) {
  return {
    venueId: id, name, address: '121 Đinh Bộ Lĩnh', city: 'TP. Hồ Chí Minh', openTime: '06:00:00', closeTime: '22:00:00',
    active: true, minPrice: 150000, maxPrice: 200000, averageRating: 4.5, totalReviews: 3, latitude: 10.8, longitude: 106.7,
    imageUrls: [], amenities: [], sportTypes: ['BADMINTON'], courts: []
  };
}

test('Sân đã lưu: liệt kê theo thứ tự đã lưu, bỏ lưu thì thẻ biến mất', async ({ page }) => {
  // 14 sân đã lưu: trang 1 có 12, trang 2 có 2. Id dạng v00..v13, v00 là mới lưu nhất.
  const ids = Array.from({ length: 14 }, (_, i) => `00000000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`);
  let saved = [...ids];
  const requestedIds: string[][] = [];
  await mockGoatSportsApi(page);
  await page.route('**/social-service/api/v1/social/follows/venues/me', route =>
    route.fulfill({ json: ok(saved.map((id, i) => ({ venueId: id, savedAt: `2026-10-${String(20 - i).padStart(2, '0')}T10:00:00` }))) }));
  await page.route('**/social-service/api/v1/social/follows/venues/0000*', route => {
    const id = route.request().url().split('/').pop()!;
    if (route.request().method() === 'DELETE') saved = saved.filter(item => item !== id);
    return route.fulfill({ json: ok({ venueId: id, followed: route.request().method() !== 'DELETE' }) });
  });
  await page.route('**/venue-service/api/v1/venues?**', route => {
    const pageIds = new URL(route.request().url()).searchParams.getAll('ids');
    requestedIds.push(pageIds);
    // venue-service khong giu thu tu: tra nguoc lai de chac UI tu sap theo thu tu da luu.
    // San so 14 da ngung hoat dong: venue-service khong tra ve.
    const items = [...pageIds].reverse().filter(id => id !== ids[13]).map(id => venue(id, `Sân số ${ids.indexOf(id) + 1}`));
    return route.fulfill({ json: ok({ items, total: items.length, page: 0, pageSize: items.length, totalPages: 1 }) });
  });

  await page.goto('/venues/saved');
  await expect(page.getByRole('heading', { name: 'Sân đã lưu' })).toBeVisible();
  const cards = page.locator('app-venue-card');
  await expect(cards).toHaveCount(12);
  await expect(cards.first()).toContainText('Sân số 1');
  // Mot lan goi cho ca 14 id (lo 50); so dem chi tinh san con hoat dong (13), khop voi so the.
  expect(requestedIds).toHaveLength(1);
  expect(requestedIds[0]).toHaveLength(14);
  await expect(page.locator('.results__count')).toContainText('13 sân đã lưu');
  await expect(page.locator('app-pagination')).toContainText('Hiển thị 1 - 12 trong tổng số 13 sân');

  // Bỏ lưu sân đầu: sân thứ 13 trượt lên, còn 12 sân nên hết phân trang.
  await cards.first().getByRole('button', { name: 'Bỏ lưu sân' }).click();
  await expect(cards.first()).toContainText('Sân số 2');
  await expect(cards).toHaveCount(12);
  await expect(page.locator('.grid')).toContainText('Sân số 13');
  await expect(page.locator('.results__count')).toContainText('12 sân đã lưu');
  await expect(page.locator('app-pagination')).toHaveCount(0);
});

test('Sân đã lưu: chưa lưu sân nào thì có lời mời đi tìm sân', async ({ page }) => {
  await mockGoatSportsApi(page);
  await page.route('**/social-service/api/v1/social/follows/venues/me', route => route.fulfill({ json: ok([]) }));
  await page.goto('/venues/saved');
  await expect(page.getByText('Chưa lưu sân nào')).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'Tìm sân', exact: true })).toHaveAttribute('href', '/venues');
});

test('Chọn ngày khác ở chi tiết sân bằng lịch tự làm', async ({ page }) => {
  const slotDates: string[] = [];
  const courtId = 'c7397670-2693-30f3-8188-baf3469fe5ec';
  await mockGoatSportsApi(page);
  await page.route(`**/venue-service/api/v1/venues/${venueId}`, route => route.fulfill({ json: ok({
    ...venue(venueId, 'Sân thể thao Bình Thạnh'),
    courts: [{ venueCourtId: courtId, venueId, sportType: 'BADMINTON', name: 'Sân 2', capacity: 4, active: true }]
  }) }));
  await page.route(`**/venue-courts/${courtId}/slots**`, route => {
    slotDates.push(new URL(route.request().url()).searchParams.get('date')!);
    return route.fulfill({ json: ok([]) });
  });

  await page.goto(`/venues/${venueId}`);
  await page.locator('.court-option').first().click();
  await page.getByRole('button', { name: 'Chọn ngày khác' }).click();
  const panel = page.locator('.date-picker__panel');
  await expect(panel).toBeVisible();
  // Không có <input type="date"> native nào trên trang.
  await expect(page.locator('input[type="date"]')).toHaveCount(0);

  // Hôm qua bị khóa (trước min), quá 30 ngày cũng khóa; chọn ngày sau 7 ngày (sang tháng nếu cần).
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (yesterday.getMonth() === today.getMonth()) {
    await expect(panel.locator(`[data-iso="${iso(yesterday)}"]`)).toBeDisabled();
  }
  const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
  if (next.getMonth() !== today.getMonth()) await panel.getByRole('button', { name: 'Tháng sau' }).click();
  await panel.locator(`[data-iso="${iso(next)}"]`).click();
  await expect(panel).toBeHidden();
  await expect.poll(() => slotDates.at(-1)).toBe(iso(next));

  // Bàn phím: mở lại, Esc đóng.
  await page.getByRole('button', { name: /^Chọn ngày khác/ }).click();
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
