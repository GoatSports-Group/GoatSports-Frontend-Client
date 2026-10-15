import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

// Cài đặt cho tắt / bật việc dùng hoạt động để gợi ý (phần "Dành cho bạn" ở trang chủ: home-personal.spec.ts).

test('cài đặt: tắt gợi ý theo hoạt động gửi lên máy chủ và báo đã xóa lịch sử', async ({ page }) => {
  await mockGoatSportsApi(page);
  const saved: unknown[] = [];
  await page.route('**/ai-service/api/v1/ai/personalization/settings', route => {
    if (route.request().method() === 'PUT') {
      saved.push(route.request().postDataJSON());
      return route.fulfill({ json: { enabled: false } });
    }
    return route.fulfill({ json: { enabled: true } });
  });
  await page.goto('/settings?tab=security');

  const toggle = page.getByRole('checkbox', { name: 'Gợi ý theo hoạt động của bạn' });
  await expect(toggle).toBeChecked();
  await toggle.click();

  await expect(toggle).not.toBeChecked();
  await expect(page.locator('#personalization-help')).toContainText('Đã tắt');
  expect(saved).toEqual([{ enabled: false }]);
});
