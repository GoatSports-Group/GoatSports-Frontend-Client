import { expect, test } from '@playwright/test';
import { mockGoatSportsApi, storageCalls } from './fixtures/api.fixture';

// Chromium tu tao mot camera gia (khung hinh test) va tu cho phep quyen, de chup that tu getUserMedia.
test.use({
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }
});

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const image = (name: string) => ({ name, mimeType: 'image/png', buffer: PNG });

test.beforeEach(async ({ page }) => {
  storageCalls.presign.length = 0;
  storageCalls.messages.length = 0;
  await mockGoatSportsApi(page);
  await page.goto('/chat');
  await page.locator('.room').filter({ hasText: /Trần Hoàng Nam/ }).click();
  await expect(page.getByText('Mình đặt sân 2 rồi, bạn chỉ cần mang vợt.')).toBeVisible();
});

test('gửi 3 ảnh đi thành một tin nhắn dạng lưới, không phải 3 tin riêng', async ({ page }) => {
  await page.getByLabel('Chọn ảnh để gửi').setInputFiles([image('a.png'), image('b.png'), image('c.png')]);
  await expect(page.locator('.draft__item img')).toHaveCount(3);
  await page.getByRole('button', { name: 'Bỏ ảnh 2' }).click();
  await page.getByLabel('Chọn ảnh để gửi').setInputFiles([image('d.png')]);
  await page.getByRole('textbox', { name: 'Nội dung tin nhắn' }).fill('Ảnh sân hôm nay');
  await page.getByRole('button', { name: 'Gửi tin nhắn' }).click();

  const gallery = page.locator('.msg.is-mine').last().getByRole('group', { name: '3 ảnh' });
  await expect(gallery.getByRole('button', { name: /Xem ảnh/ })).toHaveCount(3);
  await expect(page.locator('.msg.is-mine').last()).toContainText('Ảnh sân hôm nay');
  await expect(page.locator('.msg.is-mine.is-sending')).toHaveCount(0);

  // Mot lo URL tai len vao thu muc rieng tu, va dung MOT request gui tin mang ca 3 khoa anh.
  expect(storageCalls.presign).toHaveLength(1);
  expect(storageCalls.presign[0].map(item => item.folder)).toEqual(['chat-messages', 'chat-messages', 'chat-messages']);
  expect(storageCalls.messages).toHaveLength(1);
  const sent = storageCalls.messages[0] as { type: string; attachments: Array<{ storageKey: string }> };
  expect(sent.type).toBe('IMAGE');
  expect(sent.attachments.map(item => item.storageKey)).toEqual([
    expect.stringContaining('a.png'), expect.stringContaining('c.png'), expect.stringContaining('d.png')
  ]);

  await gallery.getByRole('button', { name: 'Xem ảnh 2 trên 3' }).click();
  await expect(page.getByRole('dialog', { name: 'Xem ảnh và video' })).toContainText('2 / 3');
});

test('chụp ảnh bằng camera rồi gửi lên cuộc trò chuyện', async ({ page }) => {
  await page.getByRole('button', { name: 'Chụp ảnh bằng camera' }).click();
  const camera = page.getByRole('dialog', { name: 'Chụp ảnh' });
  await camera.getByRole('button', { name: 'Chụp ảnh' }).click();
  await expect(camera.getByRole('img', { name: 'Ảnh vừa chụp' })).toBeVisible();
  await camera.getByRole('button', { name: 'Dùng ảnh này' }).click();

  await expect(page.locator('.draft__item img')).toHaveCount(1);
  await page.getByRole('button', { name: 'Gửi tin nhắn' }).click();
  await expect(page.locator('.msg.is-mine').last().getByRole('group', { name: '1 ảnh' })).toBeVisible();
  await expect(page.locator('.msg.is-mine.is-sending')).toHaveCount(0);
  const sent = storageCalls.messages[0] as { attachments: Array<{ storageKey: string; fileName: string }> };
  expect(sent.attachments).toHaveLength(1);
  expect(sent.attachments[0].fileName).toMatch(/^camera-.*\.jpg$/);
});

test('dán ảnh từ clipboard vào ô soạn tin', async ({ page }) => {
  const box = page.getByRole('textbox', { name: 'Nội dung tin nhắn' });
  await box.evaluate(element => {
    const data = new DataTransfer();
    data.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'shot.png', { type: 'image/png' }));
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(page.locator('.draft__item img')).toHaveCount(1);
});
