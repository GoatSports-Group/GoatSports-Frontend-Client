import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

// Người dùng đang ngồi yên (không gửi request nào) khi admin khóa tài khoản / khi họ yêu cầu xóa tài khoản ở thiết bị
// khác: notification-service đẩy SESSION_REVOKED qua websocket và tab đăng xuất ngay, không đợi thao tác kế tiếp.

const USER_ID = '11111111-1111-4111-8111-111111111111';
const frame = (command: string, headers: Record<string, string>, body = '') =>
  `${command}\n${Object.entries(headers).map(([k, v]) => `${k}:${v}`).join('\n')}\n\n${body}\0`;

async function pushSessionRevoked(page: import('@playwright/test').Page, reason: string) {
  let push: (() => void) | null = null;
  await page.routeWebSocket(/notification-service\/ws/, ws => {
    ws.onMessage(message => {
      const text = String(message);
      if (text.startsWith('CONNECT')) ws.send(frame('CONNECTED', { version: '1.2', 'heart-beat': '0,0' }));
      if (text.startsWith('SUBSCRIBE') && text.includes(`/topic/user/session/${USER_ID}`)) {
        const id = /id:(.*)/.exec(text)?.[1]?.trim() ?? 'sub-user-session';
        push = () => ws.send(frame('MESSAGE', {
          destination: `/topic/user/session/${USER_ID}`, subscription: id, 'message-id': '1',
          'content-type': 'application/json'
        }, JSON.stringify({ type: 'SESSION_REVOKED', reason })));
      }
    });
  });
  return () => expect.poll(() => push !== null).toBe(true).then(() => push!());
}

test('admin khóa tài khoản khi tab đang ngồi yên: đăng xuất ngay qua websocket', async ({ page }) => {
  await mockGoatSportsApi(page);
  const send = await pushSessionRevoked(page, 'ACCOUNT_BLOCKED');
  await page.goto('/notifications');

  await send();

  await expect(page.getByText('Tài khoản đã bị khóa')).toBeVisible();
  await expect(page).toHaveURL(/\/home/);
});

test('admin bỏ xác thực khi đang ở trang chủ: đăng xuất và trang chủ đổi ngay sang trang khách, không cần tải lại', async ({ page }) => {
  await mockGoatSportsApi(page);
  const send = await pushSessionRevoked(page, 'ACCOUNT_INACTIVE');
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: /Chào buổi/i })).toBeVisible();
  let reloads = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) reloads++; });

  await send();

  await expect(page.getByText('Tài khoản chưa được kích hoạt')).toBeVisible();
  await expect(page.getByRole('link', { name: /Tạo tài khoản miễn phí/i }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Chào buổi/i })).toHaveCount(0);
  expect(reloads).toBeLessThanOrEqual(1); // chỉ đổi URL trong SPA, không tải lại trang
});

// Cookie HttpOnly cũ còn trong trình duyệt thì gateway trả 401 cho mọi request mang nó, kể cả API công khai của trang
// khách. Client phải gọi /auth/logout (máy chủ xóa cookie) trước khi trang khách tải giải đấu / CLB.
test('bị thu hồi phiên: xóa cookie trước rồi trang khách mới tải giải đấu và CLB, không báo lỗi', async ({ page }) => {
  await mockGoatSportsApi(page);
  let revoked = false;
  let cookieCleared = false;
  await page.route(url => url.pathname.includes('/club-service/api/v1/'), route =>
    revoked && !cookieCleared
      ? route.fulfill({ status: 401, json: { error: 'ACCOUNT_INACTIVE', message: 'Tài khoản cần được xác thực lại.' } })
      : route.fallback());
  await page.route(url => url.pathname.endsWith('/auth-service/api/v1/auth/logout'), route => {
    cookieCleared = true;
    return route.fulfill({ json: { data: null, statusCode: 200, message: 'Success', error: null } });
  });
  const send = await pushSessionRevoked(page, 'ACCOUNT_INACTIVE');
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: /Chào buổi/i })).toBeVisible();

  revoked = true;
  await send();

  await expect(page.getByRole('link', { name: /Tạo tài khoản miễn phí/i }).first()).toBeVisible();
  expect(cookieCleared).toBe(true);
  await page.getByRole('link', { name: /Tạo tài khoản miễn phí/i }).last().scrollIntoViewIfNeeded();
  await expect(page.getByText('Chưa tải được giải đấu.')).toHaveCount(0);
  await expect(page.getByText('Chưa tải được câu lạc bộ.')).toHaveCount(0);
});

test('yêu cầu xóa tài khoản ở thiết bị khác: tab này đăng xuất và báo cách giữ tài khoản', async ({ page }) => {
  await mockGoatSportsApi(page);
  const send = await pushSessionRevoked(page, 'ACCOUNT_DELETION_PENDING');
  await page.goto('/notifications');

  await send();

  await expect(page.getByText('Tài khoản đang chờ xóa')).toBeVisible();
  await expect(page).toHaveURL(/\/home/);
});
