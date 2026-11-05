import { expect, test, type Page } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

// Khách xem và tìm bài công khai trên Cộng đồng; người bị xử lý xem quyết định kiểm duyệt và khiếu nại.
const ok = (data: unknown) => ({ json: { statusCode: 200, message: 'OK', data } });
const author = '33333333-3333-4333-8333-333333333333';

const page0 = (content: unknown[]) => ({
  content, number: 0, size: 10, totalElements: content.length, totalPages: 1, first: true, last: true,
  numberOfElements: content.length, empty: !content.length
});

function post(postId: string, content: string) {
  const now = new Date().toISOString();
  return {
    postId, authorId: author, content, visibility: 'PUBLIC', status: 'PUBLISHED', sport: 'BADMINTON',
    sharedPostId: null, sharedPost: null, sharedPostUnavailable: false, tags: [], mentions: [], attachments: [],
    likeCount: 3, commentCount: 0, shareCount: 0, likedByCurrentUser: false, savedByCurrentUser: false,
    createdAt: now, updatedAt: now, publishedAt: now, playerCall: null
  };
}

async function openAsGuest(page: Page, path: string) {
  await mockGoatSportsApi(page);
  await page.route(/auth-service\/api\/v1\/auth\/(me|refresh)/, route => route.fulfill({ status: 401, json: { statusCode: 401 } }));
  const feed: URLSearchParams[] = [];
  const authOnly: string[] = [];
  await page.route(url => url.pathname.endsWith('/social/posts'), route => {
    const params = new URL(route.request().url()).searchParams;
    feed.push(params);
    const q = params.get('q');
    return route.fulfill(ok(page0(q ? [post('p2', 'Tìm kèo cầu lông tối nay')]
      : [post('p1', 'Sáng nay đánh đôi rất vui'), post('p2', 'Tìm kèo cầu lông tối nay')])));
  });
  // Các API chỉ dành cho người đăng nhập: khách không được gọi tới.
  await page.route(/social\/(friends|follows\/users\/suggestions|blocks)|users\/me\/sport-profiles/, route => {
    authOnly.push(route.request().url());
    return route.fulfill({ status: 401, json: { statusCode: 401 } });
  });
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Cộng đồng', level: 1 })).toBeVisible();
  return { feed, authOnly };
}

test('khách xem bảng tin công khai, tìm bài theo từ khóa mà không bị bắt đăng nhập', async ({ page }) => {
  const { feed, authOnly } = await openAsGuest(page, '/feed');

  await expect(page).toHaveURL(/\/feed/);
  await expect(page.getByText('Sáng nay đánh đôi rất vui')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tham gia cộng đồng' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Đăng bài mới' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Phạm vi bảng tin' }).getByRole('button')).toHaveText([/Khám phá/]);

  await page.getByRole('searchbox', { name: 'Tìm bài viết' }).fill('kèo cầu lông');
  await page.getByRole('button', { name: 'Tìm', exact: true }).click();

  await expect(page).toHaveURL(/q=k%C3%A8o/);
  await expect(page.getByText('“kèo cầu lông”')).toBeVisible();
  await expect(page.getByText('Sáng nay đánh đôi rất vui')).toHaveCount(0);
  await expect(page.getByText('Tìm kèo cầu lông tối nay')).toBeVisible();
  expect(feed.at(-1)?.get('q')).toBe('kèo cầu lông');
  expect(authOnly).toEqual([]);
});

test('khách bấm Thích thì được đưa tới đăng nhập, không gọi API thích bài', async ({ page }) => {
  await openAsGuest(page, '/feed');
  const likes: string[] = [];
  await page.route(/social\/posts\/[^/]+\/likes?/, route => {
    likes.push(route.request().url());
    return route.fulfill(ok({}));
  });
  // Trang đăng nhập nằm ở ứng dụng auth riêng: chỉ cần thấy trình duyệt rời đi tới đó.
  await page.route(/\/login\?/, route => route.fulfill({ contentType: 'text/html', body: '<h1>Đăng nhập</h1>' }));

  await page.getByRole('button', { name: 'Thích' }).first().click();

  await expect(page).toHaveURL(/\/login\?/);
  expect(likes).toEqual([]);
});

test('người bị xử lý xem lý do trong Cài đặt và gửi khiếu nại', async ({ page }) => {
  await mockGoatSportsApi(page);
  const decisions = [{
    actionId: 'a1', actionType: 'HIDE_CONTENT', reason: 'Quảng cáo lặp lại nhiều lần',
    actionAt: '2026-11-05T10:22:00', targetType: 'POST', targetId: 'p9',
    contentSnippet: 'Bán vợt giá rẻ, inbox ngay', contentStatus: 'HIDDEN', appealable: true, appeal: null
  }];
  const appeals: unknown[] = [];
  await page.route(url => url.pathname.endsWith('/social/reports/decisions/me'),
    route => route.fulfill(ok(page0(decisions))));
  await page.route(url => url.pathname.endsWith('/social/reports/appeals'), route => {
    appeals.push(route.request().postDataJSON());
    decisions[0] = { ...decisions[0], appealable: false, appeal: {
      appealId: 'ap1', status: 'PENDING', reason: 'Đây là lịch thi đấu của CLB', createdAt: '2026-11-05T11:00:00', reviewedAt: null
    } } as typeof decisions[0];
    return route.fulfill({ status: 201, json: { statusCode: 201, message: 'OK', data: {} } });
  });

  await page.goto('/settings?tab=moderation');

  await expect(page.getByRole('heading', { name: 'Kiểm duyệt nội dung' })).toBeVisible();
  await expect(page.getByText('Bài viết đã bị ẩn')).toBeVisible();
  await expect(page.getByText('Quảng cáo lặp lại nhiều lần')).toBeVisible();

  await page.getByRole('button', { name: 'Khiếu nại' }).click();
  const dialog = page.getByRole('dialog', { name: 'Khiếu nại quyết định' });
  await expect(dialog.getByRole('button', { name: 'Gửi khiếu nại' })).toBeDisabled();
  await dialog.getByRole('textbox').fill('Đây là lịch thi đấu của CLB');
  await dialog.getByRole('button', { name: 'Gửi khiếu nại' }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Khiếu nại đang chờ xét')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Khiếu nại' })).toHaveCount(0);
  expect(appeals).toEqual([{ actionId: 'a1', reason: 'Đây là lịch thi đấu của CLB' }]);
});
