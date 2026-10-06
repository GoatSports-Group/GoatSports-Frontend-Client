import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { chatRoomsPage, mockGoatSportsApi } from './fixtures/api.fixture';

const ok = (data: unknown) => ({ json: { statusCode: 200, message: 'OK', data } });
const me = '11111111-1111-4111-8111-111111111111';
const friend = '33333333-3333-4333-8333-333333333333';
const DIRECT_ROOM = '88888888-8888-4888-8888-888888888888';

test.beforeEach(async ({ page }) => {
  await mockGoatSportsApi(page);
});

/** Dong hoi thoai trong danh sach (khong lay nham nut ⋯ cung ten). */
const roomRow = (page: Page, name: RegExp | string) => page.locator('.room').filter({ hasText: name });

test('mở hội thoại, đọc lịch sử và gửi tin nhắn', async ({ page }) => {
  await page.goto('/chat');
  await expect(page.getByRole('heading', { name: 'Tin nhắn', level: 1 })).toBeVisible();

  const room = roomRow(page, /Trần Hoàng Nam/);
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

test('chặn ngay trong đoạn chat: ô soạn tin thành thông báo kèm Bỏ chặn; không còn Báo cáo', async ({ page }) => {
  page.on('dialog', dialog => {
    throw new Error(`Hộp thoại trình duyệt không được dùng: ${dialog.message()}`);
  });
  await page.goto('/chat');
  await roomRow(page, /Trần Hoàng Nam/).click();
  await page.getByRole('button', { name: 'Thông tin cuộc trò chuyện' }).click();
  const panel = page.locator('#chat-context');
  await expect(panel.getByRole('button', { name: 'Báo cáo' })).toHaveCount(0);

  await panel.getByRole('button', { name: 'Chặn người dùng' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Xác nhận chặn' })).toBeVisible();
  await page.getByRole('button', { name: 'Chặn', exact: true }).click();

  // Van o lai doan chat; khong con o nhap, co thong bao va nut Bo chan.
  await expect(page.getByRole('textbox', { name: 'Nội dung tin nhắn' })).toHaveCount(0);
  const notice = page.locator('footer.blocked');
  await expect(notice).toContainText('Bạn đã chặn Trần Hoàng Nam');
  await expect(panel.getByRole('button', { name: 'Bỏ chặn' })).toBeVisible();

  await panel.getByRole('button', { name: 'Bỏ chặn' }).click();
  await expect(panel.getByRole('button', { name: 'Chặn người dùng' })).toBeVisible();
  await expect(page.locator('footer.blocked')).toHaveCount(0);
});

test('bị người kia chặn: không có ô soạn tin ngay từ đầu', async ({ page }) => {
  await page.route(url => url.pathname.endsWith('/social/conversations'), route => route.fulfill(ok(chatRoomsPage(items => {
    Object.assign(items[0], { blockState: 'BLOCKED_BY_THEM' });
  }))));
  await page.goto('/chat');
  await roomRow(page, /Trần Hoàng Nam/).click();
  await expect(page.locator('footer.blocked')).toContainText('Bạn không thể trả lời cuộc trò chuyện này');
  await expect(page.getByRole('textbox', { name: 'Nội dung tin nhắn' })).toHaveCount(0);
});

test('⋯ trên mỗi đoạn chat: tắt thông báo lưu ở server, Xóa chỉ xóa phía mình', async ({ page }) => {
  const calls: string[] = [];
  await page.route(url => /\/social\/conversations\/[^/]+(\/mute)?$/.test(url.pathname), async route => {
    const method = route.request().method();
    if (method === 'GET') return route.fallback();
    calls.push(`${method} ${new URL(route.request().url()).pathname.split('/conversations/')[1]}${new URL(route.request().url()).search}`);
    return route.fulfill({ status: 204, body: '' });
  });
  await page.goto('/chat');
  const row = page.locator('.room-item').filter({ hasText: 'Kèo cuối tuần' });
  await row.hover();

  await row.getByRole('button', { name: 'Tác vụ với Kèo cuối tuần' }).click();
  await page.getByRole('menuitem', { name: 'Tắt thông báo' }).click();
  await expect(row.getByLabel('Đã tắt thông báo')).toBeVisible();

  await row.getByRole('button', { name: 'Tác vụ với Kèo cuối tuần' }).click();
  await page.getByRole('menuitem', { name: 'Xóa đoạn chat' }).click();
  const dialog = page.getByRole('dialog', { name: 'Xóa đoạn chat?' });
  await expect(dialog).toContainText('chỉ bị xóa ở phía bạn');
  await dialog.getByRole('button', { name: 'Xóa đoạn chat' }).click();
  await expect(page.locator('.room-item').filter({ hasText: 'Kèo cuối tuần' })).toHaveCount(0);

  expect(calls).toEqual(['PUT aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/mute?muted=true', 'DELETE aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
});

test('đoạn chat CLB: vai trò từng người, chỉ vài thành viên và popup "Xem tất cả"', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'Khung thông tin là ngăn kéo trên điện thoại; bố cục đã kiểm ở desktop.');
  const clubId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const extra = Array.from({ length: 6 }, (_, index) => `d000000${index}-0000-4000-8000-000000000000`);
  await page.route(url => url.pathname.endsWith('/social/conversations'), route => route.fulfill(ok(chatRoomsPage(items => {
    const club = items.find(room => room.type === 'CLUB')!;
    Object.assign(club, { contextId: clubId, members: [...club.members, ...extra.map(userId => ({ userId, userName: '' }))] });
  }))));
  await page.route(url => url.pathname.endsWith(`/clubs/${clubId}/members`), route => route.fulfill(ok([
    { membershipId: 'm1', clubId, userId: friend, role: 'OWNER', status: 'ACTIVE' },
    { membershipId: 'm2', clubId, userId: me, role: 'ADMIN', status: 'ACTIVE' },
    ...extra.map((userId, index) => ({ membershipId: `x${index}`, clubId, userId, role: 'MEMBER', status: 'ACTIVE' }))
  ])));

  await page.goto('/chat');
  await roomRow(page, 'GOAT Badminton Club').click();
  await page.getByRole('button', { name: 'Thông tin cuộc trò chuyện' }).click();
  const panel = page.locator('#chat-context');
  const members = panel.locator('.members li');
  await expect(members).toHaveCount(5);
  // Chu CLB dung dau, roi quan tri, roi thanh vien.
  await expect(members.nth(0)).toContainText('Chủ CLB');
  await expect(members.nth(1)).toContainText('Quản trị viên');
  await expect(members.nth(2)).toContainText('Thành viên');

  await panel.getByRole('button', { name: 'Xem tất cả 8 thành viên' }).click();
  const dialog = page.getByRole('dialog', { name: /Thành viên · 8/ });
  await expect(dialog.locator('.members li')).toHaveCount(8);
});

test('bong bóng chat kiểu Facebook: tin mới hiện avatar, bấm mở cửa sổ chat nhỏ và trả lời', async ({ page }) => {
  // Gia lap STOMP cua social-service: CONNECTED, roi day mot tin vao kenh rieng /topic/users/{id}/messages.
  await page.routeWebSocket(/notification-service\/ws/, () => undefined);
  await page.routeWebSocket(/social-service\/ws/, ws => {
    ws.onMessage(raw => {
      const frame = String(raw);
      if (frame.startsWith('CONNECT')) ws.send('CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0');
      if (frame.startsWith('SUBSCRIBE') && frame.includes(`/topic/users/${me}/messages`)) {
        const message = {
          messageId: 'inbox-1', conversationId: DIRECT_ROOM, senderId: friend, content: 'Tối nay ra sân không?',
          type: 'TEXT', status: 'SENT', attachments: [], receipts: [], sentAt: new Date().toISOString().slice(0, 19)
        };
        setTimeout(() => ws.send(`MESSAGE\ndestination:/topic/users/${me}/messages\nsubscription:sub-social-inbox\n\n${JSON.stringify(message)}\0`), 300);
      }
    });
  });
  await page.goto('/feed');

  const head = page.getByRole('button', { name: /Mở trò chuyện với Trần Hoàng Nam, 1 tin chưa đọc/ });
  await expect(head).toBeVisible();
  await head.click();
  const mini = page.getByRole('dialog', { name: 'Trần Hoàng Nam' });
  await expect(mini).toContainText('Mình đặt sân 2 rồi, bạn chỉ cần mang vợt.');
  await mini.getByRole('textbox', { name: 'Nội dung tin nhắn' }).fill('Có nhé!');
  await mini.getByRole('textbox', { name: 'Nội dung tin nhắn' }).press('Enter');
  await expect(mini.locator('.mini__msg.is-mine').last()).toContainText('Có nhé!');

  // Thu nho: bong bong con lai (khong con so chua doc); dong: bong bong bien mat.
  await mini.getByRole('button', { name: 'Thu nhỏ' }).click();
  await expect(page.getByRole('button', { name: 'Mở trò chuyện với Trần Hoàng Nam' })).toBeVisible();
  await page.getByRole('button', { name: 'Mở trò chuyện với Trần Hoàng Nam' }).click();
  await page.getByRole('dialog', { name: 'Trần Hoàng Nam' }).getByRole('button', { name: 'Đóng' }).click();
  await expect(page.locator('app-chat-heads .head')).toHaveCount(0);
});

test('cuộn vô hạn hai chiều: mở tại tin chưa đọc, cuộn lên tải tin cũ, cuộn xuống tải tin mới', async ({ page }) => {
  // 150 tin cach nhau 1 phut; tin 100 la tin chua doc dau tien.
  const base = Date.UTC(2026, 9, 6, 1, 0, 0);
  const all = Array.from({ length: 150 }, (_, index) => ({
    messageId: `x${String(index).padStart(3, '0')}`, conversationId: DIRECT_ROOM, senderId: index % 3 ? friend : me,
    content: `Tin số ${index}`, type: 'TEXT', status: 'READ', attachments: [], receipts: [],
    sentAt: new Date(base + index * 60_000).toISOString().slice(0, 19)
  }));
  const cursors: string[] = [];
  await page.route(url => url.pathname.endsWith('/messages/unread-window'), route => route.fulfill(ok({
    messages: all.slice(90, 150).reverse().slice(10), firstUnreadMessageId: 'x100', hasOlder: true, hasNewer: true
  })));
  await page.route(url => url.pathname.endsWith('/messages/cursor'), route => {
    const params = new URL(route.request().url()).searchParams;
    const size = Number(params.get('size'));
    const after = params.get('after');
    const before = params.get('before');
    cursors.push(after ? `after ${after}` : `before ${before}`);
    const picked = after
      ? all.filter(item => item.sentAt > after).slice(0, size)
      : all.filter(item => item.sentAt < before!).slice(-size);
    return route.fulfill(ok([...picked].reverse()));
  });

  await page.goto(`/chat/${DIRECT_ROOM}`);
  const divider = page.locator('.unread-divider');
  await expect(divider).toBeVisible();
  await expect(page.locator('.msg').filter({ hasText: 'Tin số 100' })).toBeInViewport();
  // Vach nam gan dau khung tin nhan (khong bi day xuong day).
  const gap = await page.evaluate(() => document.querySelector('.unread-divider')!.getBoundingClientRect().top
    - document.querySelector('.messages')!.getBoundingClientRect().top);
  expect(gap).toBeLessThan(160);

  // Cuon xuong cuoi: tai tin moi hon cho toi tin cuoi cung.
  const scroller = page.locator('.messages');
  await expect(async () => {
    await scroller.evaluate(element => element.scrollTo(0, element.scrollHeight));
    await expect(page.getByText('Tin số 149', { exact: true })).toBeAttached({ timeout: 1000 });
  }).toPass();
  expect(cursors.some(item => item.startsWith('after'))).toBe(true);

  // Cuon len dau: tai tin cu hon cho toi tin dau tien.
  await expect(async () => {
    await scroller.evaluate(element => element.scrollTo(0, 0));
    await expect(page.getByText('Tin số 0', { exact: true })).toBeAttached({ timeout: 1000 });
  }).toPass();
  expect(cursors.some(item => item.startsWith('before'))).toBe(true);
  await expect(page.locator('.msg')).toHaveCount(150);
});

test('/chat không có lỗi WCAG A/AA tự động', async ({ page }) => {
  await page.goto('/chat');
  await roomRow(page, /Trần Hoàng Nam/).click();
  await expect(page.getByText('Mình đặt sân 2 rồi, bạn chỉ cần mang vợt.')).toBeVisible();
  const results = await new AxeBuilder({ page }).include('.chat-page')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = results.violations.map(({ id, help, nodes }) => ({ id, help, targets: nodes.flatMap(node => node.target) }));
  expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
});
