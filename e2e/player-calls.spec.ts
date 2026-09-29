import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

const ok = (data: unknown) => ({ json: { statusCode: 200, message: 'OK', data } });
const me = '11111111-1111-4111-8111-111111111111';
const poster = '33333333-3333-4333-8333-333333333333';
const room = '88888888-8888-4888-8888-888888888888';

function tomorrow(): string {
  const value = new Date(Date.now() + 86_400_000);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function callPost(postId: string, overrides: Record<string, unknown> = {}, authorId = poster) {
  return {
    postId, authorId, content: '', visibility: 'PUBLIC', status: 'PUBLISHED', sport: 'BADMINTON',
    sharedPostId: null, sharedPost: null, sharedPostUnavailable: false, tags: [], mentions: [], attachments: [],
    likeCount: 0, commentCount: 0, shareCount: 0, likedByCurrentUser: false, savedByCurrentUser: false,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), publishedAt: new Date().toISOString(),
    playerCall: {
      sport: 'BADMINTON', playFormat: 'BADMINTON_DOUBLES', playDate: tomorrow(), startTime: '19:00:00', endTime: '21:00:00',
      location: 'Nhà thi đấu Phú Thọ', slots: 1, skillNote: 'Trung bình khá', clubId: null, clubName: null, filled: false,
      ...overrides
    }
  };
}

test.describe('Tìm người chơi', () => {
  test.beforeEach(async ({ page }) => {
    await mockGoatSportsApi(page);
    await page.route('**/social-service/api/v1/social/conversations/direct?**', route => route.fulfill(ok({
      conversationId: room, type: 'DIRECT', name: 'Trần Hoàng Nam', unreadCount: 0,
      members: [{ userId: me }, { userId: poster }], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    })));
  });

  test('Trang chủ: kèo cá nhân đang mở, bấm Nhắn tin mở chat với người đăng', async ({ page }) => {
    let query = '';
    await page.route('**/social-service/api/v1/social/posts/player-calls?**', route => {
      query = new URL(route.request().url()).search;
      return route.fulfill(ok([callPost('c1c1c1c1-0000-4000-8000-000000000001')]));
    });

    await page.goto('/home');
    const rail = page.getByRole('complementary', { name: 'Trận đấu đang mở' });
    // Trên mobile rail nằm dưới màn hình đầu; GSAP chỉ hiện khi cuộn tới.
    await rail.scrollIntoViewIfNeeded();
    await expect(rail.getByText('Cầu lông · Đánh đôi')).toBeVisible();
    await expect(rail.getByText('Còn thiếu 1 người')).toBeVisible();
    await expect(rail.getByText('Nhà thi đấu Phú Thọ')).toBeVisible();
    expect(query).toContain('club=false');

    await rail.getByRole('button', { name: /Nhắn tin cho/ }).click();
    await expect(page).toHaveURL(new RegExp(`/chat/${room}`));
  });

  test('trang Câu lạc bộ: rail Trận đấu mở chỉ lấy kèo CLB', async ({ page }) => {
    let query = '';
    await page.route('**/social-service/api/v1/social/posts/player-calls?**', route => {
      query = new URL(route.request().url()).search;
      return route.fulfill(ok([callPost('c1c1c1c1-0000-4000-8000-000000000002', {
        sport: 'FOOTBALL', playFormat: 'FOOTBALL_7', slots: 3, clubId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', clubName: 'FC Bến Nghé'
      })]));
    });
    await page.route('**/club-service/api/v1/clubs?**', route => route.fulfill(ok([])));

    await page.goto('/clubs');
    await expect(page.getByText('CLB FC Bến Nghé')).toBeVisible();
    await expect(page.getByText('Bóng đá · Sân 7')).toBeVisible();
    await expect(page.getByText('Còn thiếu 3 người')).toBeVisible();
    expect(query).toContain('club=true');
  });

  test('Cộng đồng: đăng kèo từ link của trang ghép trận, rồi đánh dấu đã đủ người', async ({ page }) => {
    const created: Array<Record<string, unknown>> = [];
    const saved = callPost('c1c1c1c1-0000-4000-8000-000000000003', {}, me);
    await page.route('**/social-service/api/v1/social/posts', route => {
      if (route.request().method() !== 'POST') return route.fallback();
      created.push(route.request().postDataJSON());
      return route.fulfill(ok(saved));
    });
    let filled: unknown = null;
    await page.route(`**/social-service/api/v1/social/posts/${saved.postId}/player-call`, route => {
      filled = route.request().postDataJSON();
      return route.fulfill(ok({ ...saved, playerCall: { ...saved.playerCall, filled: true } }));
    });

    await page.goto('/feed?tab=calls&compose=find-players&sport=BADMINTON&format=BADMINTON_DOUBLES');
    await expect(page.getByRole('tab', { name: 'Tìm người chơi' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Môn', exact: true })).toContainText('Cầu lông');
    await expect(page.getByRole('button', { name: 'Hình thức', exact: true })).toContainText('Đánh đôi');
    const publish = page.getByRole('button', { name: 'Đăng kèo' });
    await expect(publish).toBeDisabled();

    await page.getByPlaceholder('Sân Chảo Lửa, Tân Bình').fill('Nhà thi đấu Phú Thọ');
    await publish.click();

    await expect.poll(() => created.length).toBe(1);
    expect(created[0]).toMatchObject({
      visibility: 'PUBLIC', sport: 'BADMINTON',
      playerCall: { sport: 'BADMINTON', playFormat: 'BADMINTON_DOUBLES', location: 'Nhà thi đấu Phú Thọ', slots: 1, clubId: null }
    });
    const card = page.locator('app-player-call').first();
    await expect(card.getByText('Còn thiếu 1 người')).toBeVisible();
    // Bài của mình: không có Nhắn tin, chỉ có Đã đủ người.
    await expect(card.getByRole('button', { name: /Nhắn tin/ })).toHaveCount(0);
    await card.getByRole('button', { name: 'Đã đủ người' }).click();
    await expect(card.getByText('Đã đủ người', { exact: true })).toBeVisible();
    expect(filled).toEqual({ filled: true });
  });
});
