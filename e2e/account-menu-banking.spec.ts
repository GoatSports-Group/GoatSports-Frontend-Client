import { expect, test, type Page } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

// Menu tai khoan chia nhom (Hoat dong / Tai khoan), dau menu dan toi trang ca nhan, so luot sap dien ra.
// Cai dat › Ngan hang: lien ket tai khoan la popup; khoan hoan tien cuon trong khung rieng (vo han).
const ok = (data: unknown) => ({ json: { data, statusCode: 200, message: null, error: null } });

async function mockBanking(page: Page, refundCount: number) {
  await mockGoatSportsApi(page);
  await page.route(url => url.pathname.endsWith('/banks'), route => route.fulfill(ok([
    { id: 1, name: 'Ngân hàng TMCP Ngoại thương', code: 'VCB', bin: '970436', shortName: 'Vietcombank', logo: '', transferSupported: true, lookupSupported: true }
  ])));
  await page.route(url => url.pathname.endsWith('/bank-accounts/me'), route => route.fulfill(ok([])));
  await page.route(url => url.pathname.endsWith('/refunds/me'), route => route.fulfill(ok(Array.from({ length: refundCount }, (_, index) => ({
    refundId: `rf-${index}`, paymentId: `p-${index}`, amount: 30000 + index * 1000, status: 'SUCCEEDED', claimable: false,
    purpose: 'BOOKING_DEPOSIT', description: `Thanh toán tiền cọc cho đơn GS${String(index).padStart(6, '0')}`,
    reason: 'Đặt nhầm giờ', createdAt: '2026-09-18T15:17:00'
  })))));
}

test('menu tài khoản: trang cá nhân ở đầu, nhóm Hoạt động / Tài khoản, số lượt sắp diễn ra', async ({ page }) => {
  await mockGoatSportsApi(page);
  await page.route(url => url.pathname.endsWith('/bookings/my-history'), route => {
    const upcoming = new URL(route.request().url()).searchParams.get('status') === 'UPCOMING';
    return route.fulfill(ok({ meta: { page: 0, pageSize: 1, pages: 1, total: upcoming ? 2 : 9 }, result: [] }));
  });
  await page.goto('/settings');
  await page.getByRole('heading', { name: 'Cài đặt', level: 1 }).waitFor();
  await page.getByRole('button', { name: 'Mở menu tài khoản' }).click();

  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem', { name: /Xem trang cá nhân/ })).toHaveAttribute('href', /^\/feed\?author=[0-9a-f-]{36}$/);
  // Nguoi choi thuong khong co nhan vai tro tieng Anh "PLAYER".
  await expect(menu).not.toContainText('PLAYER');
  await expect(menu.locator('.account-menu__label')).toHaveText(['Hoạt động', 'Tài khoản']);
  await expect(menu.getByRole('menuitem')).toHaveText([
    /Xem trang cá nhân/, /Vé đặt sân của tôi\s*2/, 'Sân đã lưu', 'CLB của tôi', 'Giải đấu của tôi', 'Hồ sơ thể thao & ELO',
    'Cài đặt', 'Trợ giúp & chính sách', 'Đăng xuất'
  ]);
  await expect(menu.getByRole('menuitem', { name: 'Giải đấu của tôi' })).toHaveAttribute('href', '/tournaments?tab=joined');
  await expect(menu.getByRole('menuitem', { name: 'Hồ sơ thể thao & ELO' })).toHaveAttribute('href', '/settings?tab=sports');
});

test('Ngân hàng: "Liên kết tài khoản" mở popup, không chèn form vào trang', async ({ page }) => {
  await mockBanking(page, 3);
  await page.goto('/settings?tab=banking');
  await expect(page.getByRole('heading', { name: 'Ngân hàng & hoàn tiền' })).toBeVisible();
  // Vao binh thuong: khong tu mo popup, chi trang thai trong.
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Liên kết tài khoản' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Liên kết tài khoản ngân hàng' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Số tài khoản' })).toBeVisible();
  await expect(page.locator('.link-form')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Để sau' }).click();
  await expect(dialog).toHaveCount(0);
});

test('Ngân hàng: khoản hoàn tiền cuộn trong khung riêng và tải thêm khi chạm đáy khung', async ({ page }) => {
  await mockBanking(page, 45);
  await page.goto('/settings?tab=banking');
  const list = page.locator('.refunds__list');
  await expect(list.locator('.refund')).toHaveCount(20);
  // Khung cuon rieng: chieu cao bi gioi han, trang khong dai ra theo danh sach.
  expect(await list.evaluate(element => element.clientHeight)).toBeLessThanOrEqual(440);
  await expect(async () => {
    await list.evaluate(element => element.scrollTo(0, element.scrollHeight));
    await expect(list.locator('.refund')).toHaveCount(45, { timeout: 1000 });
  }).toPass();
});
