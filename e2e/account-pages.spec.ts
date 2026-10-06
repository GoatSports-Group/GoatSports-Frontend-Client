import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

// Cai dat: thanh ben chi gom cac muc cai dat (khong con Lich dat san, San da luu, Ban be, Thi dau nhom).
// Thong bao: trang doc thong bao, khong co thanh ben.

test('Cài đặt: thanh bên là danh sách mục cài đặt, đổi mục cập nhật URL', async ({ page }) => {
  await mockGoatSportsApi(page);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Cài đặt', level: 1 })).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Các mục cài đặt' });
  await expect(nav.getByRole('button')).toHaveText(['Hồ sơ cá nhân', 'Hồ sơ thể thao', 'Ngân hàng & hoàn tiền', 'Đăng nhập & bảo mật']);
  for (const gone of ['Lịch đặt sân', 'Sân đã lưu', 'Bạn bè', 'Thi đấu nhóm', 'Thông báo']) {
    await expect(page.locator('.account-sidebar').getByText(gone, { exact: true })).toHaveCount(0);
  }
  await expect(page.locator('.account-tabs')).toHaveCount(0);
  await expect(nav.getByRole('button', { name: 'Hồ sơ cá nhân' })).toHaveAttribute('aria-current', 'page');

  await nav.getByRole('button', { name: 'Ngân hàng & hoàn tiền' }).click();
  await expect(page).toHaveURL(/tab=banking/);
  await expect(nav.getByRole('button', { name: 'Ngân hàng & hoàn tiền' })).toHaveAttribute('aria-current', 'page');
});

test('Thông báo: không còn thanh bên, danh sách chiếm cột giữa', async ({ page }) => {
  await mockGoatSportsApi(page);
  await page.goto('/notifications');
  await expect(page.getByRole('heading', { name: 'Thông báo', level: 1 })).toBeVisible();
  await expect(page.locator('.account-sidebar')).toHaveCount(0);
  await expect(page.locator('.account-layout--single')).toBeVisible();
});
