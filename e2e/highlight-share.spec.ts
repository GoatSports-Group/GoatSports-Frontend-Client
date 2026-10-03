import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

// Khoe len Cong dong: tran ghep AI (nguoi choi trong tran) va thanh tich giai (chu / quan tri CLB).
// The thanh tich do ai-service / club-service dung; client chi gui tieu de va loi dan.
const ok = (data: unknown) => ({ json: { statusCode: 200, message: 'OK', data } });
const me = '11111111-1111-4111-8111-111111111111';
const opponentId = '66666666-6666-4666-8666-666666666666';
const clubId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tournamentId = 't0000000-0000-4000-8000-000000000042';
const postId = 'p0000000-0000-4000-8000-000000000001';

function day(offset: number): string {
  const value = new Date(Date.now() + offset * 86_400_000);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function player(participantId: string, name: string, eloRating: number) {
  return {
    participantProfileId: `${participantId.slice(0, 8)}-pppp`, participantId, participantType: 'PLAYER', name,
    sportType: 'BADMINTON', eloRating, latitude: 10.77, longitude: 106.67, snapshotAt: new Date().toISOString()
  };
}

const completed = {
  sessionId: '77777777-7777-4777-8777-777777777777', sportType: 'BADMINTON', playDate: day(-1),
  startTime: '17:00:00', endTime: '18:00:00', timezone: 'Asia/Ho_Chi_Minh', compatibilityScore: 93, distanceKm: 0,
  eloDifference: 26, status: 'COMPLETED', matchedAt: new Date().toISOString(), expiresAt: new Date().toISOString(),
  participants: [player(me, 'Minh Đạt', 1194), player(opponentId, 'Thắng Đạt', 1220)], acceptances: [],
  result: { participantOneScore: 21, participantTwoScore: 15, winnerId: me, confirmedAt: new Date().toISOString(), eloUpdates: {} }
};

test('khoe trận đã đấu: thẻ tóm tắt tỷ số, gắn thẻ đối thủ, đăng xong có link bài', async ({ page }) => {
  await mockGoatSportsApi(page);
  await page.route('**/ai-service/api/v1/ai/matchmaking/status', route => route.fulfill({ json: { status: 'NOT_IN_QUEUE' } }));
  await page.route('**/ai-service/api/v1/ai/matchmaking/sessions?**', route => route.fulfill({ json: [completed] }));
  const shares: unknown[] = [];
  await page.route(`**/ai-service/api/v1/ai/matchmaking/sessions/${completed.sessionId}/share`, route => {
    shares.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, json: { postId } });
  });

  await page.goto('/matchmaking');
  await page.locator('.history-row').first().click();
  await page.getByRole('button', { name: 'Khoe trận lên Cộng đồng' }).click();

  const dialog = page.getByRole('dialog', { name: 'Khoe trận lên Cộng đồng' });
  await expect(dialog.locator('.share-card')).toContainText('Minh Đạt vs Thắng Đạt');
  await expect(dialog.locator('.share-card')).toContainText('Thắng 21–15');
  await expect(dialog.getByText('Thắng Đạt được gắn thẻ và nhận thông báo', { exact: false })).toBeVisible();
  await expect(dialog.getByLabel('Tiêu đề')).toHaveValue('Thắng 21–15 trước Thắng Đạt!');

  await dialog.getByLabel('Nội dung').fill('Cảm ơn kèo hay!');
  await dialog.getByRole('button', { name: 'Đăng lên Cộng đồng' }).click();

  await expect(dialog.getByText('Đã đăng lên Cộng đồng')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Xem bài viết' })).toBeVisible();
  expect(shares).toEqual([{ title: 'Thắng 21–15 trước Thắng Đạt!', content: 'Cảm ơn kèo hay!' }]);
});

test('kèo hết hạn không có nút khoe', async ({ page }) => {
  await mockGoatSportsApi(page);
  await page.route('**/ai-service/api/v1/ai/matchmaking/status', route => route.fulfill({ json: { status: 'NOT_IN_QUEUE' } }));
  await page.route('**/ai-service/api/v1/ai/matchmaking/sessions?**', route =>
    route.fulfill({ json: [{ ...completed, status: 'EXPIRED', result: undefined }] }));

  await page.goto('/matchmaking');
  await page.locator('.history-row').first().click();
  await expect(page.locator('.insights .result-state--matched')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Khoe trận lên Cộng đồng' })).toHaveCount(0);
});

async function openClubTournaments(page: import('@playwright/test').Page, role: 'OWNER' | 'MEMBER') {
  await mockGoatSportsApi(page);
  const club = {
    clubId, ownerId: role === 'OWNER' ? me : 'someone-else', name: 'Weekend Club', sportType: 'FOOTBALL', privacy: 'PUBLIC',
    approvalMode: 'MANUAL', active: true, winCount: 1, lossCount: 0, drawCount: 0, matchCount: 1, winRate: 1, memberCount: 5, tags: []
  };
  const summary = {
    tournamentId, name: 'Giải Phong Trào Mùa Thu', sportType: 'FOOTBALL', format: 'SINGLE_ELIMINATION', status: 'COMPLETED',
    startDate: day(-6), endDate: day(-4), registrationId: 'r1', teamName: 'Code FC', teamCount: 8,
    played: 3, won: 3, drawn: 0, lost: 0, rank: null, champion: true
  };
  await page.route(`**/club-service/api/v1/clubs/${clubId}`, route => route.fulfill(ok(club)));
  await page.route(`**/club-service/api/v1/clubs/${clubId}/membership/me`, route =>
    route.fulfill(ok({ membershipId: 'm-me', clubId, userId: me, role, status: 'ACTIVE' })));
  await page.route(`**/club-service/api/v1/clubs/${clubId}/tournaments`, route => route.fulfill(ok([summary])));
  await page.route(`**/club-service/api/v1/tournaments/${tournamentId}**`, route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith(tournamentId)) {
      return route.fulfill(ok({ ...summary, organizerId: 'o1', maxParticipants: 8, currentParticipants: 8, entryFee: 0,
        prizePool: 0, registrationOpenDate: day(-20), registrationCloseDate: day(-8), rules: [], description: null }));
    }
    return route.fulfill(ok([]));
  });
  const shares: unknown[] = [];
  await page.route(`**/club-service/api/v1/clubs/${clubId}/tournaments/${tournamentId}/share`, route => {
    shares.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, ...ok({ postId }) });
  });
  await page.goto(`/clubs/${clubId}`);
  await page.getByRole('tab', { name: 'Giải đấu' }).click();
  await expect(page.getByRole('link', { name: 'Xem trang giải đấu' })).toBeVisible();
  return shares;
}

test('chủ CLB khoe chức vô địch, thành viên CLB được gắn thẻ', async ({ page }) => {
  const shares = await openClubTournaments(page, 'OWNER');
  await page.getByRole('button', { name: 'Khoe lên Cộng đồng' }).click();

  const dialog = page.getByRole('dialog', { name: 'Khoe thành tích giải lên Cộng đồng' });
  await expect(dialog.locator('.share-card')).toContainText('Giải Phong Trào Mùa Thu');
  await expect(dialog.locator('.share-card')).toContainText('Vô địch');
  await expect(dialog.getByLabel('Tiêu đề')).toHaveValue('Weekend Club vô địch Giải Phong Trào Mùa Thu!');
  await dialog.getByRole('button', { name: 'Đăng lên Cộng đồng' }).click();
  await expect(dialog.getByRole('button', { name: 'Xem bài viết' })).toBeVisible();
  expect(shares).toEqual([{ title: 'Weekend Club vô địch Giải Phong Trào Mùa Thu!', content: null }]);
});

test('thành viên thường không thấy nút khoe thành tích giải', async ({ page }) => {
  await openClubTournaments(page, 'MEMBER');
  await expect(page.getByRole('button', { name: 'Khoe lên Cộng đồng' })).toHaveCount(0);
});

test('bài khoe trên bảng tin: bảng tỷ số và người được gắn thẻ', async ({ page }) => {
  await mockGoatSportsApi(page);
  await page.route(url => url.pathname.endsWith('/social/posts'), route => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill(ok({
      content: [{
        postId, authorId: me, content: 'Cảm ơn kèo hay!', visibility: 'PUBLIC', status: 'PUBLISHED', sport: 'BADMINTON',
        sharedPostId: null, sharedPost: null, sharedPostUnavailable: false, tags: [], mentions: [], attachments: [],
        likeCount: 0, commentCount: 0, shareCount: 0, likedByCurrentUser: false, savedByCurrentUser: false,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), publishedAt: new Date().toISOString(),
        highlight: {
          kind: 'MATCH', refId: completed.sessionId, title: 'Thắng 21–15 trước Thắng Đạt!', headline: 'Cầu lông · Đánh đơn',
          subtitle: 'Thứ Sáu, 02/10/2026 · 17:00–18:00', result: 'Thắng 21–15',
          sides: [{ name: 'Minh Đạt', score: 21, winner: true }, { name: 'Thắng Đạt', score: 15, winner: false }],
          stats: [{ label: 'Độ phù hợp', value: '93%' }, { label: 'ELO', value: '+16' }],
          clubId: null, clubName: null, tagged: [opponentId]
        }
      }],
      number: 0, size: 10, totalElements: 1, totalPages: 1, first: true, last: true, numberOfElements: 1, empty: false
    }));
  });

  await page.goto('/feed?tab=explore&sport=all');
  const card = page.locator('app-post-highlight');
  await expect(page.getByRole('heading', { name: 'Thắng 21–15 trước Thắng Đạt!' })).toBeVisible();
  await expect(card.locator('.hl__score')).toHaveAttribute('aria-label', 'Tỷ số 21 – 15');
  await expect(card.locator('.hl__result')).toHaveText('Thắng 21–15');
  await expect(card.locator('.hl__stats')).toContainText('+16');
  await expect(card.locator('.hl-tags__person')).toHaveAttribute('href', `/feed?author=${opponentId}`);
});
