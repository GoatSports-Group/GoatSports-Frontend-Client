import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

test.beforeEach(async ({ page }) => {
  await mockGoatSportsApi(page);
});

test('điều hướng bỏ qua đưa bàn phím tới nội dung chính', async ({ page }) => {
  await page.goto('/home');
  await expect(page.locator('#main-content')).toBeVisible();
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Chuyển đến nội dung chính' });
  await expect(skipLink).toBeFocused();
  await skipLink.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('trang chính không tràn ngang ở viewport hiện tại', async ({ page }) => {
  for (const path of ['/home', '/venues', '/feed']) {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    const sizes = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth
    }));
    expect(sizes.content, `${path} bị tràn ngang`).toBeLessThanOrEqual(sizes.viewport + 1);
  }
});

test('modal chia sẻ giữ focus và đóng bằng Escape', async ({ page }) => {
  await page.goto('/feed');
  await page.getByRole('button', { name: 'Chia sẻ', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Chia sẻ bài viết' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('textarea')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Chia sẻ', exact: true })).toBeFocused();
});

test('tiêu đề tài liệu thay đổi theo route', async ({ page }) => {
  await page.goto('/venues');
  await expect(page).toHaveTitle('Tìm sân đấu | GOAT Sports');
  await page.goto('/feed');
  await expect(page).toHaveTitle('Bảng tin | GOAT Sports');
});
