import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

// Dữ liệu thật: venue-service trả null cho danh sách trống. Trước đây `amenities: null` ném lỗi `.slice`
// giữa lượt cập nhật, Angular bỏ dở phần còn lại của template nên icon (Lưu sân, Chia sẻ, địa chỉ) không hiện.
const venueId = '17397670-2693-30f3-8188-baf3469fe5ec';

test('chi tiết sân có danh sách null vẫn hiện đủ và có icon', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await mockGoatSportsApi(page);
  await page.route(`**/venue-service/api/v1/venues/${venueId}`, route => route.fulfill({ json: {
    data: {
      venueId, name: 'Sân thể thao Bình Thạnh', address: '121 Đinh Bộ Lĩnh', city: 'TP. Hồ Chí Minh',
      openTime: '06:00:00', closeTime: '22:00:00', active: true, minPrice: 150000, maxPrice: 200000,
      averageRating: 0, totalReviews: 0, latitude: 10.80, longitude: 106.71,
      imageUrls: null, amenities: null, sportTypes: null, courts: null
    },
    statusCode: 200, message: null, error: null
  } }));

  await page.goto(`/venues/${venueId}`);
  await expect(page.getByRole('heading', { name: 'Sân thể thao Bình Thạnh' })).toBeVisible();
  const actions = page.locator('.heading-actions');
  await expect(actions.getByRole('button', { name: /Lưu sân/ })).toBeVisible();
  // Icon đã nhận tên và vẽ ra svg.
  await expect(actions.locator('lucide-icon svg')).toHaveCount(2);
  expect(errors.filter(text => /reading 'slice'|reading 'length'/.test(text))).toEqual([]);
});
