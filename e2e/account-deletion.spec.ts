import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

// Người dùng tự xóa tài khoản (Cài đặt › Đăng nhập & bảo mật): auth-service hỏi venue/payment/club còn việc dang dở
// không, gửi mã qua email, xác nhận thì chờ 30 ngày và đăng xuất mọi nơi.

const ok = (data: unknown) => ({ data, statusCode: 200, message: 'Success', error: null });
const DELETION = '/auth-service/api/v1/users/me/deletion';

test('còn vé sắp chơi và đang làm chủ CLB: chỉ liệt kê việc cần xử lý, không cho gửi mã', async ({ page }) => {
  await mockGoatSportsApi(page);
  await page.route(url => url.pathname.endsWith(DELETION),
    route => route.fulfill({ json: ok({ blockers: ['OPEN_BOOKINGS', 'CLUB_OWNER'] }) }));

  await page.goto('/settings?tab=security');
  await page.getByRole('button', { name: 'Xóa tài khoản' }).click();

  const dialog = page.getByRole('dialog', { name: 'Chưa thể xóa tài khoản' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Bạn còn vé đặt sân chưa diễn ra')).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'CLB của tôi' })).toHaveAttribute('href', '/clubs/my');
  await expect(dialog.getByRole('button', { name: 'Gửi mã xác nhận' })).toHaveCount(0);
});

test('không vướng gì: gửi mã, nhập mã + gõ XÓA rồi đăng xuất và báo ngày xóa', async ({ page }) => {
  await mockGoatSportsApi(page);
  const calls: string[] = [];
  let submitted: unknown = null;
  await page.route(url => url.pathname.endsWith(DELETION) || url.pathname.endsWith(`${DELETION}/code`), route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    calls.push(`${request.method()} ${path.endsWith('/code') ? 'code' : 'deletion'}`);
    if (request.method() === 'GET') return route.fulfill({ json: ok({ blockers: [] }) });
    if (path.endsWith('/code')) return route.fulfill({ json: ok(null) });
    submitted = request.postDataJSON();
    return route.fulfill({ json: ok({ purgeAt: '2026-11-20T09:00:00' }) });
  });
  let loggedOut = false;
  await page.route(url => url.pathname.endsWith('/auth-service/api/v1/auth/logout'), route => {
    loggedOut = true;
    return route.fulfill({ json: ok(null) });
  });

  await page.goto('/settings?tab=security');
  await page.getByRole('button', { name: 'Xóa tài khoản' }).click();
  const dialog = page.getByRole('dialog', { name: 'Xóa tài khoản' });
  await expect(dialog.getByText('Sẽ bị xóa')).toBeVisible();
  await dialog.getByRole('button', { name: 'Gửi mã xác nhận' }).click();

  const confirm = dialog.getByRole('button', { name: 'Xóa tài khoản' });
  await dialog.getByLabel('Mã xác nhận').fill('123456');
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('Gõ XÓA để xác nhận').fill('xóa');
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page.getByText('Đã nhận yêu cầu xóa tài khoản')).toBeVisible();
  await expect(page.getByText('20/11/2026')).toBeVisible();
  await expect(page).toHaveURL(/\/home/);
  expect(submitted).toEqual({ code: '123456' });
  expect(calls).toEqual(['GET deletion', 'POST code', 'POST deletion']);
  expect(loggedOut).toBe(true);
});

test('yêu cầu xóa từ thiết bị khác: phiên ở đây bị đăng xuất và được báo cách giữ tài khoản', async ({ page }) => {
  await mockGoatSportsApi(page);
  await page.route(url => url.pathname.endsWith('/notification-service/api/v1/notifications'),
    route => route.fulfill({ status: 401, json: { error: 'ACCOUNT_DELETION_PENDING', message: 'Tài khoản đang chờ xóa.' } }));

  await page.goto('/notifications');

  await expect(page.getByText('Tài khoản đang chờ xóa')).toBeVisible();
  await expect(page.getByText('Đăng nhập lại trước thời hạn đó')).toBeVisible();
  await expect(page).toHaveURL(/\/home/);
});
