import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

// Tro giup & chinh sach nam trong layout client (header, footer chuan), co tab giua 4 trang;
// form lien he gui that toi auth-service, kem chu de, roi hien trang thai "Da gui".

test('trang Liên hệ hỗ trợ dùng header chuẩn, có tab chính sách và gửi yêu cầu thật', async ({ page }) => {
  await mockGoatSportsApi(page);
  const sent: Array<Record<string, string>> = [];
  await page.route(url => url.pathname.endsWith('/auth-service/api/v1/support/requests'), route => {
    sent.push(route.request().postDataJSON());
    return route.fulfill({ status: 202, body: '' });
  });
  await page.goto('/policy/contact-support');

  await expect(page.getByRole('heading', { name: 'Liên hệ hỗ trợ', level: 1 })).toBeVisible();
  // Header chuan cua client (menu tai khoan), khong con header rieng "Ve trang chu".
  await expect(page.getByRole('button', { name: 'Mở menu tài khoản' })).toBeVisible();
  await expect(page.getByText('Về trang chủ', { exact: true })).toHaveCount(0);
  const tabs = page.getByRole('navigation', { name: 'Trợ giúp & chính sách' });
  await expect(tabs.getByRole('link')).toHaveText(['Liên hệ hỗ trợ', 'Chính sách đặt sân', 'Hủy sân & hoàn tiền', 'Tiêu chuẩn sân đấu']);
  await expect(tabs.getByRole('link', { name: 'Liên hệ hỗ trợ' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: 'goatsports1312@gmail.com' })).toHaveAttribute('href', 'mailto:goatsports1312@gmail.com');

  // Da dang nhap: ten va email dien san. Thieu chu de thi khong gui.
  await expect(page.getByRole('textbox', { name: /Họ và tên/ })).not.toHaveValue('');
  await page.getByRole('textbox', { name: /Tiêu đề/ }).fill('Chưa nhận được tiền hoàn cọc');
  await page.getByRole('textbox', { name: /Nội dung chi tiết/ }).fill('Mình hủy lượt GSLV8ZUP hôm qua mà chưa thấy tiền về.');
  await page.getByRole('button', { name: 'Gửi yêu cầu' }).click();
  await expect(page.getByText('Chọn chủ đề gần nhất với vấn đề của bạn.')).toBeVisible();
  expect(sent).toHaveLength(0);

  await page.getByRole('button', { name: 'Chủ đề' }).click();
  await page.getByRole('option', { name: 'Hủy sân & hoàn tiền' }).click();
  await page.getByRole('button', { name: 'Gửi yêu cầu' }).click();
  await expect(page.locator('.contact-sent')).toContainText('Đã gửi yêu cầu hỗ trợ');
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ topic: 'REFUND', subject: 'Chưa nhận được tiền hoàn cọc' });

  await page.getByRole('button', { name: 'Gửi yêu cầu khác' }).click();
  await expect(page.getByRole('textbox', { name: /Tiêu đề/ })).toHaveValue('');
});

test('các trang chính sách khác cũng trong layout client và chuyển tab được', async ({ page }) => {
  await mockGoatSportsApi(page);
  await page.goto('/policy/booking-policy');
  await expect(page.getByRole('heading', { name: 'Chính sách đặt sân', level: 1 })).toBeVisible();
  await page.getByRole('navigation', { name: 'Trợ giúp & chính sách' }).getByRole('link', { name: 'Hủy sân & hoàn tiền' }).click();
  await expect(page).toHaveURL(/\/policy\/cancellation-policy$/);
  await expect(page.getByRole('button', { name: 'Mở menu tài khoản' })).toBeVisible();
});
