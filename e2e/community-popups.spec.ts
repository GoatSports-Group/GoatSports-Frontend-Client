import { expect, test, type Page } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

// Cong dong kieu ung dung: bai viet luon mo trong popup, binh luan tra loi nhieu cap + cuon vo han,
// danh sach theo doi / goi y cuon vo han, chi cot giua cuon tren desktop.
const ok = (data: unknown) => ({ json: { statusCode: 200, message: 'OK', data } });
const me = '11111111-1111-4111-8111-111111111111';
const poster = '33333333-3333-4333-8333-333333333333';
const postId = '44444444-4444-4444-8444-444444444444';

function post(id: string, authorId = poster, extra: Record<string, unknown> = {}) {
  return {
    postId: id, authorId, content: `Bài ${id.slice(0, 4)}`, visibility: 'PUBLIC', status: 'PUBLISHED', sport: 'BADMINTON',
    sharedPostId: null, sharedPost: null, sharedPostUnavailable: false, tags: [], mentions: [], attachments: [],
    likeCount: 0, commentCount: 4, shareCount: 0, likedByCurrentUser: false, savedByCurrentUser: false,
    createdAt: '2026-10-01T08:00:00', updatedAt: '2026-10-01T08:00:00', publishedAt: '2026-10-01T08:00:00', ...extra
  };
}

const springPage = (content: unknown[], number = 0, last = true) => ({
  content, number, size: 10, totalElements: content.length, totalPages: 1, first: number === 0, last,
  numberOfElements: content.length, empty: !content.length
});

function comment(id: string, authorId: string, content: string, parent: string | null, minute: number) {
  return { commentId: id, postId, authorId, parentCommentId: parent, content, mentions: [], status: 'PUBLISHED',
    createdAt: `2026-10-01T09:${String(minute).padStart(2, '0')}:00`, updatedAt: `2026-10-01T09:${String(minute).padStart(2, '0')}:00` };
}

async function setup(page: Page) {
  await mockGoatSportsApi(page);
  const feedPages: string[] = [];
  const created: Array<Record<string, unknown>> = [];
  await page.route(url => url.pathname.endsWith('/social/posts'), route => {
    if (route.request().method() !== 'GET') return route.fallback();
    const number = Number(new URL(route.request().url()).searchParams.get('page') ?? 0);
    feedPages.push(String(number));
    const items = Array.from({ length: number === 0 ? 10 : 3 }, (_, index) =>
      post(`${number}${index}000000-0000-4000-8000-00000000000${index % 10}`));
    if (number === 0) items[0] = post(postId);
    return route.fulfill(ok(springPage(items, number, number > 0)));
  });
  await page.route(url => url.pathname.endsWith(`/social/posts/${postId}`), route =>
    route.request().method() === 'GET' ? route.fulfill(ok(post(postId))) : route.fallback());
  await page.route(url => url.pathname.endsWith(`/social/posts/${postId}/comments`), route => {
    if (route.request().method() === 'POST') {
      created.push(route.request().postDataJSON());
      return route.fulfill(ok(comment('c9', me, 'mới', created.at(-1)!['parentCommentId'] as string, 30)));
    }
    return route.fulfill(ok(springPage([
      comment('c1', me, 'hết slot nha', null, 1),
      comment('c2', me, 'sdffdsf', 'c1', 2),
      comment('c3', me, 'sdfdsf', 'c1', 3),
      comment('c4', poster, 'ádasdas', 'c2', 4)
    ])));
  });
  return { feedPages, created };
}

test('bấm "Bình luận" mở popup; trả lời nằm ngay dưới bình luận được trả lời', async ({ page }) => {
  const { created } = await setup(page);
  await page.goto('/feed?sport=all');
  const card = page.locator('app-post-card').first();
  await card.getByRole('button', { name: 'Bình luận', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: /Bài viết của/ });
  await expect(dialog).toBeVisible();
  await expect(page).not.toHaveURL(/feed\/posts/);
  const nodes = dialog.locator('.comment-node');
  await expect(nodes).toHaveCount(4);
  // Cay theo chieu sau: c1, c2, c4 (tra loi c2), c3.
  await expect(nodes.locator('.comment__bubble p')).toHaveText(['hết slot nha', 'sdffdsf', 'ádasdas', 'sdfdsf']);
  expect(await nodes.evaluateAll(items => items.map(item => item.getAttribute('data-depth')))).toEqual(['0', '1', '2', '1']);

  // Tra loi "sdffdsf" thi gui dung cha la c2 (khong ep ve binh luan goc nua).
  await nodes.nth(1).getByRole('button', { name: 'Trả lời' }).click();
  await dialog.getByLabel('Viết bình luận').fill('ok');
  await dialog.getByLabel('Viết bình luận').press('Enter');
  await expect.poll(() => created.length).toBe(1);
  expect(created[0]['parentCommentId']).toBe('c2');

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('link cũ /feed/posts/:id chuyển về bảng tin và mở popup; đóng thì bỏ ?post', async ({ page }) => {
  await setup(page);
  await page.goto(`/feed/posts/${postId}`);
  await expect(page).toHaveURL(new RegExp(`/feed\\?.*post=${postId}`));
  const dialog = page.getByRole('dialog', { name: /Bài viết của/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Đóng' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).not.toHaveURL(/post=/);
});

test('bảng tin cuộn vô hạn trong cột giữa; tab và cột bên đứng yên, không còn tiêu đề trang và thẻ "Chơi đẹp"', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'Bố cục cột chỉ có từ 1024px.');
  const { feedPages } = await setup(page);
  await page.goto('/feed?sport=all');
  await expect(page.locator('app-post-card')).toHaveCount(10);
  await expect(page.getByText('Chơi đẹp cả trên mạng.')).toHaveCount(0);
  await expect(page.locator('.page-title')).toHaveCount(0);

  const tabsBefore = await page.locator('.feed__head .tabs').boundingBox();
  const railBefore = await page.locator('.rail--right').boundingBox();
  await page.locator('.feed__scroll').evaluate(element => element.scrollTo(0, element.scrollHeight));
  await expect.poll(() => feedPages).toContain('1');
  await expect(page.locator('app-post-card')).toHaveCount(13);
  expect((await page.locator('.feed__head .tabs').boundingBox())!.y).toBe(tabsBefore!.y);
  expect((await page.locator('.rail--right').boundingBox())!.y).toBe(railBefore!.y);
  // Trang khong tu cuon: chi cot giua. Khung ngoai khong co gi tran ra (chu .sr-only trong bai tung keo dai trang).
  expect(await page.evaluate(() => document.querySelector('mat-sidenav-content')!.scrollTop)).toBe(0);
  expect(await page.evaluate(() => {
    const frame = document.querySelector('mat-sidenav-content')!;
    return frame.scrollHeight - frame.clientHeight;
  })).toBeLessThanOrEqual(1);

  // Lan chuot o khoang trong canh trai (ngoai cac cot): bang tin cuon, trang dung yen.
  await page.locator('.feed__scroll').evaluate(element => element.scrollTo(0, 0));
  const viewport = page.viewportSize()!;
  await page.mouse.move(4, viewport.height - 40);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.locator('.feed__scroll').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.querySelector('mat-sidenav-content')!.scrollTop)).toBe(0);
});

test('Người theo dõi / Đang theo dõi mở popup hai tab, cuộn vô hạn', async ({ page }) => {
  await setup(page);
  const lists: string[] = [];
  await page.route(url => /\/follows\/users\/[^/]+\/(followers|following)$/.test(url.pathname), route => {
    const url = new URL(route.request().url());
    const kind = url.pathname.split('/').pop()!;
    const number = Number(url.searchParams.get('page') ?? 0);
    lists.push(`${kind}:${number}`);
    const people = Array.from({ length: number === 0 ? 20 : 2 }, (_, index) =>
      ({ userId: `${kind === 'followers' ? 'a' : 'b'}${number}${String(index).padStart(6, '0')}-0000-4000-8000-000000000000`,
        followedAt: '2026-09-20T10:00:00' }));
    return route.fulfill(ok(springPage(people, number, number > 0)));
  });

  await page.goto(`/feed?author=${poster}`);
  await page.getByRole('button', { name: /Xem người theo dõi/ }).waitFor();
  // Bam chuot vao con so (khong phai chu cua nut): ca o phai la vung bam, ke ca khi nut "lun" xuong luc nhan.
  const number = (await page.locator('.stats__open dd').first().boundingBox())!;
  await page.mouse.click(number.x + number.width / 2, number.y + number.height / 2);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('tab', { name: /Người theo dõi/ })).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.locator('.people li')).toHaveCount(20);
  await dialog.locator('.follow-dialog__body').evaluate(element => element.scrollTo(0, element.scrollHeight));
  await expect(dialog.locator('.people li')).toHaveCount(22);

  await dialog.getByRole('tab', { name: /Đang theo dõi/ }).click();
  await expect.poll(() => lists).toContain('following:0');
  await expect(dialog.locator('.people li')).toHaveCount(20);
});

test('tab trống của popup theo dõi chỉ là một dòng chữ', async ({ page }) => {
  await setup(page);
  await page.route(url => /\/follows\/users\/[^/]+\/(followers|following)$/.test(url.pathname), route =>
    route.fulfill(ok(springPage([]))));
  await page.goto(`/feed?author=${poster}`);
  await page.getByRole('button', { name: /Xem đang theo dõi/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.follow-dialog__empty')).toHaveText('Chưa theo dõi ai');
  await expect(dialog.locator('.state')).toHaveCount(0);
  await expect(dialog.locator('.follow-dialog__empty')).toHaveCSS('border-top-width', '0px');
});

test('"Xem tất cả" gợi ý chuyển sang Bạn bè › Gợi ý, cuộn vô hạn theo offset', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'Cột phải ẩn dưới 1024px.');
  await setup(page);
  const offsets: string[] = [];
  await page.route(url => url.pathname.endsWith('/follows/users/suggestions'), route => {
    const url = new URL(route.request().url());
    const offset = Number(url.searchParams.get('offset') ?? 0);
    offsets.push(String(offset));
    const size = Number(url.searchParams.get('limit') ?? 5);
    const count = offset === 0 ? size : 3;
    return route.fulfill(ok(Array.from({ length: count }, (_, index) => ({
      authorId: `c${offset}${String(index).padStart(6, '0')}-0000-4000-8000-000000000000`, postCount: 0,
      reason: 'Đã ghép trận với bạn'
    }))));
  });

  await page.goto('/feed?sport=all');
  await page.locator('.rail--right .rail-card').filter({ hasText: 'Gợi ý theo dõi' })
    .getByRole('button', { name: 'Xem tất cả' }).click();
  await expect(page).toHaveURL(/tab=friends/);
  await expect(page).toHaveURL(/list=suggestions/);
  const rows = page.locator('app-community-friends .rows .row');
  await expect(rows).toHaveCount(20);
  await expect(rows.first()).toContainText('Đã ghép trận với bạn');
  // Chu tren nut chinh mau trang (khong bi class trung ten lam mo).
  await expect(rows.first().locator('.btn--primary .btn-label')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.locator('.feed__scroll').evaluate(element => element.scrollTo(0, element.scrollHeight));
  await expect.poll(() => offsets).toContain('20');
  await expect(rows).toHaveCount(23);
});

test('popup soạn bài: công cụ một hàng, nút Hủy / Đăng ở hàng dưới', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'Điện thoại dùng bố cục hai hàng riêng của ô soạn.');
  await setup(page);
  await page.goto('/feed?sport=all');
  await page.getByRole('region', { name: 'Đăng bài mới' }).getByRole('button', { name: 'Bài viết' }).click();
  const dialog = page.getByRole('dialog', { name: 'Đăng lên Cộng đồng' });
  const tools = await dialog.locator('.composer__tools').boundingBox();
  const submit = await dialog.locator('.composer__submit').boundingBox();
  expect(submit!.y).toBeGreaterThan(tools!.y + tools!.height - 1);
  // Hai o chon (mon, ai xem) chia deu phan con lai, khong bi cat chu.
  const selects = dialog.locator('.tool-select');
  const widths = await selects.evaluateAll(items => items.map(item => Math.round(item.getBoundingClientRect().width)));
  expect(Math.abs(widths[0] - widths[1])).toBeLessThanOrEqual(1);
  expect(widths[0]).toBeGreaterThan(150);
});

test('popup theo dõi không giật khi mở: nền tối phủ đúng màn hình ngay từ frame đầu', async ({ page }) => {
  await setup(page);
  await page.goto(`/feed?author=${poster}`);
  const open = page.getByRole('button', { name: /Xem người theo dõi/ });
  await open.waitFor();
  await open.click();
  // Do nhieu frame lien tiep trong luc hieu ung con chay.
  const frames = await page.evaluate(() => new Promise<number[][]>(resolve => {
    const rects: number[][] = [];
    const tick = () => {
      const backdrop = document.querySelector('app-follow-list-dialog .modal-backdrop');
      if (backdrop) {
        const r = backdrop.getBoundingClientRect();
        rects.push([Math.round(r.top), Math.round(r.height)]);
      }
      if (rects.length < 12) requestAnimationFrame(tick); else resolve(rects);
    };
    tick();
  }));
  const height = await page.evaluate(() => innerHeight);
  for (const [top, h] of frames) {
    expect(top).toBe(0);
    expect(h).toBe(height);
  }
});
