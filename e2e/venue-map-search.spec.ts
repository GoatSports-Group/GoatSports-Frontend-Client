import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

const nearbyVenue = {
  venueId: '55555555-5555-4555-8555-555555555555',
  name: 'Wolf',
  description: 'Sân thể thao tại Nha Trang',
  openTime: '06:00:00',
  closeTime: '23:00:00',
  active: true,
  minPrice: 200_000,
  maxPrice: 200_000,
  averageRating: 0,
  totalReviews: 0,
  phone: '',
  email: '',
  address: '44 Đường Phước Long, Phường Nam Nha Trang, Tỉnh Khánh Hòa',
  ward: 'Phường Nam Nha Trang',
  district: 'Nam Nha Trang',
  city: 'Khánh Hòa',
  latitude: 12.210398,
  longitude: 109.193565,
  imageUrls: [],
  amenities: ['Sân có', 'Nước uống'],
  sportTypes: ['FOOTBALL'],
  totalCourts: 2,
  distanceKm: 0.2
};

test('tìm trong vùng bản đồ giữ nguyên vị trí dùng để tính khoảng cách', async ({ page }) => {
  await mockGoatSportsApi(page);
  const venueRequests: URL[] = [];

  await page.route('**/venue-service/api/v1/venues**', async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.endsWith('/venue-service/api/v1/venues')) {
      await route.fallback();
      return;
    }

    venueRequests.push(url);
    await route.fulfill({
      json: {
        data: { items: [nearbyVenue], total: 1, page: 0, pageSize: 12, totalPages: 1 },
        statusCode: 200,
        message: null,
        error: null
      }
    });
  });

  await page.goto('/venues?latitude=12.210398&longitude=109.193565&radiusKm=10');
  await expect(page.locator('.home-card__distance')).toContainText('0.2 km');

  await page.locator('.leaflet-control-zoom-in').click();
  await page.getByRole('button', { name: 'Tìm kiếm trong vùng hiển thị' }).click();
  await expect.poll(() => venueRequests.length).toBeGreaterThanOrEqual(2);

  const viewportRequest = venueRequests.at(-1)!;
  expect(viewportRequest.searchParams.get('latitude')).toBe('12.210398');
  expect(viewportRequest.searchParams.get('longitude')).toBe('109.193565');
  expect(viewportRequest.searchParams.has('radiusKm')).toBe(false);
  for (const bound of ['northLatitude', 'southLatitude', 'eastLongitude', 'westLongitude']) {
    expect(viewportRequest.searchParams.has(bound), `${bound} chưa được gửi`).toBe(true);
  }

  await expect(page.getByText('trong vùng bản đồ')).toBeVisible();
  await expect(page.locator('.home-card__distance')).toContainText('0.2 km');
});
