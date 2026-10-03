import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

// Cong dong chi phuc vu tim nguoi choi va chia se the thao, ca nhan hoa theo mon cua nguoi dang nhap.
const ok = (data: unknown) => ({ json: { statusCode: 200, message: 'OK', data } });
const me = '11111111-1111-4111-8111-111111111111';
const poster = '33333333-3333-4333-8333-333333333333';

function day(offset: number): string {
  const value = new Date(Date.now() + offset * 86_400_000);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function callPost(postId: string, authorId: string, call: Record<string, unknown> = {}) {
  const sport = (call['sport'] as string) ?? 'BADMINTON';
  return {
    postId, authorId, content: '', visibility: 'PUBLIC', status: 'PUBLISHED', sport,
    sharedPostId: null, sharedPost: null, sharedPostUnavailable: false, tags: [], mentions: [], attachments: [],
    likeCount: 0, commentCount: 0, shareCount: 0, likedByCurrentUser: false, savedByCurrentUser: false,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), publishedAt: new Date().toISOString(),
    playerCall: {
      sport, playFormat: 'BADMINTON_DOUBLES', playDate: day(2), startTime: '19:30:00', endTime: '21:00:00',
      location: 'Nhà thi đấu Phú Thọ', slots: 2, skillNote: null, clubId: null, clubName: null, filled: false, ...call
    }
  };
}

const page0 = (content: unknown[]) => ({
  content, number: 0, size: 10, totalElements: content.length, totalPages: 1, first: true, last: true,
  numberOfElements: content.length, empty: !content.length
});

const myCall = callPost('c0000000-0000-4000-8000-000000000001', me, { location: 'Sân Chảo Lửa', slots: 1 });
const theirCall = callPost('c0000000-0000-4000-8000-000000000002', poster, { location: 'Sân Thống Nhất' });

async function openCommunity(page: Page, path: string) {
  await mockGoatSportsApi(page);
  await page.route('**/auth-service/api/v1/users/me/sport-profiles', route => route.fulfill(ok([
    { profileId: 'p1', sportType: 'BADMINTON', skillLevel: 'INTERMEDIATE', eloRating: 1200, preferredPositions: [],
      winCount: 0, lossCount: 0, drawCount: 0, matchCount: 0, winRate: 0, availabilities: [], createdAt: '', updatedAt: '' }
  ])));
  const feed: URLSearchParams[] = [];
  const suggestions: URLSearchParams[] = [];
  await page.route(url => url.pathname.endsWith('/social/posts'), route => {
    if (route.request().method() !== 'GET') return route.fallback();
    const params = new URL(route.request().url()).searchParams;
    feed.push(params);
    if (params.get('playerCallsOnly') !== 'true') return route.fallback();
    const mine = params.get('authorId') === me;
    return route.fulfill(ok(page0(mine ? [myCall] : [myCall, theirCall])));
  });
  await page.route(url => url.pathname.endsWith('/follows/users/suggestions'), route => {
    suggestions.push(new URL(route.request().url()).searchParams);
    return route.fulfill(ok([]));
  });
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Cộng đồng', level: 1 })).toBeVisible();
  return { feed, suggestions };
}

test('chỉ những gì phục vụ tìm người chơi và chia sẻ; không còn lối tắt CLB, giải đấu, ghép kèo AI', async ({ page }) => {
  await openCommunity(page, '/feed');
  const community = page.locator('main.community');
  await expect(community.locator('a[href="/clubs/my"], a[href="/tournaments"], a[href="/matchmaking"], a[href="/clubs"]')).toHaveCount(0);
  await expect(community.getByText('Giải đang mở đăng ký')).toHaveCount(0);
  await expect(community.getByText('Câu lạc bộ nổi bật')).toHaveCount(0);

  const tabs = page.getByRole('navigation', { name: 'Phạm vi bảng tin' });
  // "Tim nguoi choi" khong con la tab; the ho so khong con 3 dong thong ke (trang ca nhan da co).
  await expect(tabs.getByRole('button')).toHaveText([/Khám phá/, /Đang theo dõi/, /Đã lưu/, /Bạn bè/]);
  await expect(page.locator('.profile .stats')).toHaveCount(0);
});

test('tab Tìm người chơi mở sẵn ở môn của bạn, chỉ kèo còn mở', async ({ page }, testInfo) => {
  const { feed, suggestions } = await openCommunity(page, '/feed?tab=calls');
  await expect(page.locator('.tag-banner')).toContainText('Kèo đang tìm người');

  await expect(page.getByRole('button', { name: 'Môn của bạn' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => feed.some(params => params.get('playerCallsOnly') === 'true' && params.get('sports') === 'BADMINTON'
    && !params.get('authorId'))).toBe(true);
  await expect.poll(() => suggestions.some(params => params.get('sports') === 'BADMINTON')).toBe(true);
  await expect(page.locator('app-player-call')).toHaveCount(2);

  if (!testInfo.project.name.startsWith('mobile')) {
    const rail = page.locator('.rail--left');
    await expect(rail.locator('.my-sports')).toContainText('Cầu lông');
    await expect(rail.locator('.my-sports')).toContainText('Trung bình');
    // Keo cua toi: chi keo cua minh, con mo.
    await expect(rail.getByRole('link', { name: /Sân Chảo Lửa/ })).toBeVisible();
    await expect(rail.getByRole('link', { name: /Sân Thống Nhất/ })).toHaveCount(0);
    expect(feed.some(params => params.get('authorId') === me && params.get('playerCallsOnly') === 'true')).toBe(true);
  }

  // Bo "Mon cua ban" thi lay moi mon.
  await page.getByRole('button', { name: 'Tất cả môn' }).click();
  await expect(page).toHaveURL(/sport=all/);
  await expect.poll(() => feed.at(-1)?.get('sports') ?? null).toBeNull();
});

test('soạn kèo / bài viết và chỉnh sửa bài đều mở trong hộp thoại', async ({ page }, testInfo) => {
  await openCommunity(page, '/feed?tab=calls');
  const bar = page.getByRole('region', { name: 'Đăng bài mới' });
  const dialog = page.getByRole('dialog', { name: 'Đăng lên Cộng đồng' });
  await expect(bar).toBeVisible();
  await expect(page.locator('app-post-composer')).toHaveCount(0);

  await bar.getByRole('button', { name: 'Tìm người chơi' }).click();
  await expect(dialog.getByPlaceholder('Sân Chảo Lửa, Tân Bình')).toBeVisible();
  // Mon mac dinh cua keo = mon trong ho so.
  await expect(dialog.getByRole('button', { name: 'Môn', exact: true })).toContainText('Cầu lông');
  await dialog.getByRole('button', { name: 'Hủy' }).click();
  await expect(dialog).toHaveCount(0);

  await bar.getByRole('button', { name: 'Bài viết' }).click();
  await expect(dialog.locator('textarea')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  if (!testInfo.project.name.startsWith('mobile')) {
    await page.locator('.rail--left').getByRole('button', { name: 'Tạo kèo' }).click();
    await expect(dialog.getByPlaceholder('Sân Chảo Lửa, Tân Bình')).toBeVisible();
    await dialog.getByRole('button', { name: 'Đóng' }).click();
  }

  // Chinh sua kèo cua minh: hop thoai, form dien san.
  const mine = page.locator('app-post-card').filter({ hasText: 'Sân Chảo Lửa' });
  await mine.getByRole('button', { name: 'Tác vụ bài viết' }).click();
  await page.getByRole('menuitem', { name: 'Chỉnh sửa bài viết' }).click();
  const edit = page.getByRole('dialog', { name: 'Chỉnh sửa kèo' });
  await expect(edit.getByPlaceholder('Sân Chảo Lửa, Tân Bình')).toHaveValue('Sân Chảo Lửa');
  await expect(edit.getByRole('button', { name: 'Lưu thay đổi' })).toBeVisible();
});

test('Đang theo dõi chỉ xin bài của người mình theo dõi, bài mới của mình không chen vào', async ({ page }) => {
  const { feed } = await openCommunity(page, '/feed?tab=following');
  await expect.poll(() => feed.some(params => params.get('followingOnly') === 'true' && !params.get('withFriends'))).toBe(true);
});

test('Khám phá: thẻ "Kèo hợp với bạn" chỉ có kèo của người khác', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'Cột phải ẩn dưới 1024px; kèo nằm trong khối gợi ý của bảng tin.');
  await openCommunity(page, '/feed');
  const card = page.locator('.rail--right .rail-card').filter({ hasText: 'Kèo hợp với bạn' });
  await expect(card.getByRole('link', { name: /Sân Thống Nhất/ })).toBeVisible();
  await expect(card.getByRole('link', { name: /Sân Chảo Lửa/ })).toHaveCount(0);

  const results = await new AxeBuilder({ page }).include('main.community').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.map(item => item.id)).toEqual([]);
});

test('link cũ "Bài của tôi" chuyển sang trang cá nhân', async ({ page }) => {
  await openCommunity(page, '/feed?tab=mine');
  await expect(page).toHaveURL(new RegExp(`author=${me}`));
  await expect(page.getByRole('button', { name: 'Toàn bộ bảng tin' })).toBeVisible();
});

test('gợi ý theo dõi hiện lý do: đã ghép trận, cùng CLB, bạn chung', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'Cột phải ẩn dưới 1024px.');
  await openCommunity(page, '/feed');
  await page.route(url => url.pathname.endsWith('/follows/users/suggestions'), route => route.fulfill(ok([
    { authorId: poster, postCount: 0, reason: 'Đã ghép trận với bạn · 1 bạn chung' }
  ])));
  await page.reload();
  const card = page.locator('.rail--right .rail-card').filter({ hasText: 'Gợi ý theo dõi' });
  await expect(card.locator('.people li')).toHaveCount(1);
  await expect(card).toContainText('Đã ghép trận với bạn · 1 bạn chung');
  await expect(card).not.toContainText('bài trong 30 ngày');
});

test('chủ đề nổi bật theo môn đang lọc, đếm theo số người; trống thì ẩn thẻ', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'Cột phải ẩn dưới 1024px.');
  const trending: URLSearchParams[] = [];
  let empty = false;
  await openCommunity(page, '/feed');
  await page.route(url => url.pathname.endsWith('/social/posts/tags/trending'), route => {
    trending.push(new URL(route.request().url()).searchParams);
    return route.fulfill(ok(empty ? [] : [{ tag: 'cầulông', postCount: 7, authorCount: 4 }]));
  });
  await page.reload();
  const card = page.locator('.rail--right .rail-card').filter({ hasText: 'Chủ đề nổi bật' });
  await expect(card.getByRole('link', { name: /#cầulông/ })).toContainText('4');
  // Mac dinh "Mon cua ban" (cau long): chu de lay theo mon do.
  expect(trending.at(-1)?.get('sports')).toBe('BADMINTON');

  empty = true;
  await page.getByRole('button', { name: 'Tất cả môn' }).click();
  await expect.poll(() => trending.at(-1)?.get('sports') ?? null).toBeNull();
  await expect(card).toHaveCount(0);
});

test('gõ # trong ô soạn bài gợi ý chủ đề hay dùng, so khớp không dấu', async ({ page }) => {
  await openCommunity(page, '/feed');
  await page.route(url => url.pathname.endsWith('/social/posts/tags/suggestions'), route =>
    route.fulfill(ok([{ tag: 'cầulông', postCount: 9, authorCount: 5 }, { tag: 'bóngđá', postCount: 3, authorCount: 2 }])));
  await page.getByRole('region', { name: 'Đăng bài mới' }).getByRole('button', { name: 'Bài viết' }).click();
  const dialog = page.getByRole('dialog', { name: 'Đăng lên Cộng đồng' });
  const area = dialog.locator('textarea');
  await area.pressSequentially('Sáng mai đánh #cau');
  const menu = dialog.getByRole('listbox', { name: 'Chủ đề' });
  await expect(menu.getByRole('option')).toHaveText(['#cầulông']);
  await area.press('Enter');
  await expect(area).toHaveValue('Sáng mai đánh #cầulông ');
  await expect(menu).toHaveCount(0);
});
