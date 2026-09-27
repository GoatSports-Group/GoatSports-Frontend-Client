import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

test.beforeEach(async ({ page }) => {
  await mockGoatSportsApi(page);
});

test('mở hội thoại, đọc lịch sử và gửi tin nhắn', async ({ page }) => {
  await page.goto('/chat');
  await expect(page.getByRole('heading', { name: 'Tin nhắn', level: 1 })).toBeVisible();

  const room = page.getByRole('button', { name: /Trần Hoàng Nam/ });
  if (test.info().project.name.startsWith('mobile')) {
    // Tren dien thoai danh sach hien truoc, chua hoi thoai nao bi mo san hay danh dau da doc.
    await expect(room.getByLabel('2 tin chưa đọc')).toBeVisible();
  }
  await room.click();

  await expect(page.getByText('Mình đặt sân 2 rồi, bạn chỉ cần mang vợt.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Nội dung tin nhắn' }).fill('Ok, 19h gặp nhé!');
  await page.getByRole('button', { name: 'Gửi tin nhắn' }).click();
  await expect(page.locator('.msg.is-mine').last()).toContainText('Ok, 19h gặp nhé!');
  await expect(page.locator('.msg.is-mine.is-sending')).toHaveCount(0);
});

test('chặn và báo cáo dùng xác nhận trong trang, không dùng hộp thoại trình duyệt', async ({ page }) => {
  page.on('dialog', dialog => {
    throw new Error(`Hộp thoại trình duyệt không được dùng: ${dialog.message()}`);
  });
  await page.goto('/chat');
  await page.getByRole('button', { name: /Trần Hoàng Nam/ }).click();
  await page.getByRole('button', { name: 'Thông tin cuộc trò chuyện' }).click();

  await page.getByRole('button', { name: 'Chặn người dùng' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Xác nhận chặn' })).toBeVisible();
  await page.getByRole('button', { name: 'Giữ lại' }).click();

  await page.getByRole('button', { name: 'Báo cáo' }).click();
  const dialog = page.getByRole('dialog', { name: /Báo cáo/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Gửi báo cáo' })).toBeDisabled();
});

test('/chat không có lỗi WCAG A/AA tự động', async ({ page }) => {
  await page.goto('/chat');
  await page.getByRole('button', { name: /Trần Hoàng Nam/ }).click();
  await expect(page.getByText('Mình đặt sân 2 rồi, bạn chỉ cần mang vợt.')).toBeVisible();
  const results = await new AxeBuilder({ page }).include('.chat-page')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = results.violations.map(({ id, help, nodes }) => ({ id, help, targets: nodes.flatMap(node => node.target) }));
  expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
});
