import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

// Chuông thông báo: số chưa đọc lớn hơn 99 thì hiện "99+" (số thật vẫn đọc được qua aria-label).
test('chuông thông báo: trên 99 tin chưa đọc thì hiện 99+', async ({ page }) => {
  await mockGoatSportsApi(page);
  await page.route(url => url.pathname.endsWith('/notification-service/api/v1/notifications/unread-count'),
    route => route.fulfill({ json: { statusCode: 200, message: 'OK', data: 150 } }));
  await page.goto('/home');

  const badge = page.locator('.notif-count-badge');
  await expect(badge).toHaveText('99+');
  await expect(badge).toHaveAttribute('aria-label', '150 thông báo chưa đọc');
});
