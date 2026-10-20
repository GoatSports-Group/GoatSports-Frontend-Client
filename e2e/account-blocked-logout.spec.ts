import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

// Admin khóa tài khoản khi người dùng đang dùng: gateway trả 401 ACCOUNT_BLOCKED cho token còn hạn.
// Client đăng xuất ngay, báo lý do, không thử refresh.
test('tài khoản bị khóa giữa phiên: đăng xuất ngay và báo lý do', async ({ page }) => {
  await mockGoatSportsApi(page);
  let refreshCalls = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname.endsWith('/auth-service/api/v1/auth/refresh')) refreshCalls++;
  });
  await page.route(url => url.pathname.endsWith('/notification-service/api/v1/notifications'),
    route => route.fulfill({ status: 401, json: { error: 'ACCOUNT_BLOCKED', message: 'Tài khoản của bạn đã bị khóa.' } }));

  await page.goto('/notifications');

  await expect(page.getByText('Tài khoản đã bị khóa')).toBeVisible();
  await expect(page.getByText('Đăng nhập lại để gửi khiếu nại')).toBeVisible();
  await expect(page).toHaveURL(/\/home/);
  expect(refreshCalls).toBe(0);
});
