import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

const ok = (data: unknown) => ({ json: { statusCode: 200, message: 'OK', data } });

test.describe('Lịch sử thi đấu trong hồ sơ thể thao', () => {
  test.beforeEach(async ({ page }) => {
    await mockGoatSportsApi(page);
    await page.route('**/auth-service/api/v1/users/me/sport-profiles', route => route.fulfill(ok([{
      profileId: 'p-badminton', sportType: 'BADMINTON', skillLevel: 'INTERMEDIATE', eloRating: 1206,
      preferredPositions: [], playStyle: 'BALANCED', city: 'Hồ Chí Minh', playRadiusKm: 10, discoverable: true,
      winCount: 1, lossCount: 1, drawCount: 0, matchCount: 2, winRate: 0.5, availabilities: []
    }])));
    await page.route('**/auth-service/api/v1/users/me/sport-profiles/BADMINTON/history', route => route.fulfill(ok([
      {
        resultId: 'r-1', source: 'TOURNAMENT', referenceId: 't-1', title: 'Bán kết · Trận 1 · GOAT Cup',
        opponentName: 'Nguyễn Minh', myScore: 21, opponentScore: 19, opponentElo: 1180, outcome: 'WIN',
        oldElo: 1200, newElo: 1218, delta: 18, playedAt: '2026-09-27T19:30:00'
      },
      {
        resultId: 'r-2', source: 'MATCHMAKING', title: 'Ghép trận', opponentName: 'Trần Đạt', myScore: 15,
        opponentScore: 21, opponentElo: 1250, outcome: 'LOSS', oldElo: 1218, newElo: 1206, delta: -12,
        playedAt: '2026-09-28T08:00:00'
      }
    ])));
  });

  test('mở lịch sử thấy từng trận: giải hay ghép trận, đối thủ, tỷ số và ELO cộng/trừ', async ({ page }) => {
    await page.goto('/settings?tab=sports');
    await page.getByRole('button', { name: /Lịch sử thi đấu/ }).click();

    const dialog = page.getByRole('dialog', { name: 'Lịch sử thi đấu · Cầu lông' });
    const rows = dialog.getByRole('listitem');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Thắng');
    await expect(rows.nth(0)).toContainText('Bán kết · Trận 1 · GOAT Cup');
    await expect(rows.nth(0)).toContainText('gặp Nguyễn Minh (1180)');
    await expect(rows.nth(0)).toContainText('21–19');
    await expect(rows.nth(0)).toContainText('+18');
    await expect(rows.nth(0)).toContainText('1200 → 1218');
    await expect(rows.nth(1)).toContainText('Ghép trận');
    await expect(rows.nth(1)).toContainText('−12');

    await dialog.getByRole('button', { name: 'Đóng' }).click();
    await expect(dialog).toHaveCount(0);
  });
});

test.describe('Tab Giải đấu của câu lạc bộ', () => {
  const clubId = 'club-1';
  const matchRequests: string[] = [];

  test.beforeEach(async ({ page }) => {
    matchRequests.length = 0;
    await mockGoatSportsApi(page);
    await page.route(`**/club-service/api/v1/clubs/${clubId}`, route => route.fulfill(ok({
      clubId, ownerId: 'someone-else', name: 'CLB Cầu Lông Phú Nhuận', sportType: 'BADMINTON', privacy: 'PUBLIC',
      approvalMode: 'MANUAL', active: true, winCount: 10, lossCount: 3, drawCount: 2, matchCount: 15,
      tournamentCount: 2, winRate: 0.67, memberCount: 12, tags: []
    })));
    await page.route(`**/club-service/api/v1/clubs/${clubId}/tournaments`, route => route.fulfill(ok([
      {
        tournamentId: 't-autumn', name: 'Autumn Cup 2026', sportType: 'BADMINTON', format: 'SINGLE_ELIMINATION',
        status: 'PUBLISHED', startDate: '2026-10-10', endDate: '2026-10-11', registrationId: 'reg-autumn',
        teamName: 'CLB Cầu Lông Phú Nhuận', teamCount: 8, played: 0, won: 0, drawn: 0, lost: 0, rank: null, champion: false
      },
      {
        tournamentId: 't-league', name: 'GOAT Shuttle League 2026', sportType: 'BADMINTON', format: 'ROUND_ROBIN',
        status: 'COMPLETED', startDate: '2026-06-14', endDate: '2026-09-17', registrationId: 'reg-league',
        teamName: 'CLB Cầu Lông Phú Nhuận', teamCount: 5, played: 14, won: 9, drawn: 2, lost: 3, rank: 1, champion: true
      }
    ])));
    await page.route(`**/club-service/api/v1/clubs/${clubId}/matches/page**`, route => {
      const url = new URL(route.request().url());
      const tournamentId = url.searchParams.get('tournamentId');
      if (tournamentId) matchRequests.push(tournamentId);
      const content = tournamentId === 't-league' ? [{
        matchId: 'm-1', tournamentId: 't-league', tournamentName: 'GOAT Shuttle League 2026', opponentName: 'Gym FC',
        playedAt: '2026-09-16T20:00:00', clubScore: 21, opponentScore: 19, result: 'WIN'
      }] : [];
      return route.fulfill(ok({ content, page: { size: 3, number: 0, totalElements: content.length, totalPages: content.length ? 1 : 0 } }));
    });
    for (const [id, name, format] of [['t-autumn', 'Autumn Cup 2026', 'SINGLE_ELIMINATION'], ['t-league', 'GOAT Shuttle League 2026', 'ROUND_ROBIN']]) {
      await page.route(`**/club-service/api/v1/tournaments/${id}`, route => route.fulfill(ok({
        tournamentId: id, name, format, sportType: 'BADMINTON', status: 'COMPLETED',
        startDate: '2026-06-14', endDate: '2026-09-17', description: ''
      })));
      await page.route(`**/club-service/api/v1/tournaments/${id}/teams`, route => route.fulfill(ok([
        { registrationId: `reg-${id === 't-league' ? 'league' : 'autumn'}`, teamName: 'CLB Cầu Lông Phú Nhuận', clubId }
      ])));
      await page.route(`**/club-service/api/v1/tournaments/${id}/standings`, route => route.fulfill(ok([])));
    }
  });

  test('liệt kê mọi giải CLB đã tham gia và chọn giải nào thì xem đúng trận của giải đó', async ({ page }) => {
    await page.goto(`/clubs/${clubId}`);
    await page.getByRole('tablist', { name: 'Nội dung câu lạc bộ' }).getByRole('tab', { name: 'Giải đấu' }).click();

    await expect(page.getByRole('heading', { name: '2 giải đã tham gia' })).toBeVisible();
    const tabs = page.getByRole('tablist', { name: 'Các giải đã tham gia' }).getByRole('tab');
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.nth(0)).toContainText('Chưa thi đấu');
    await expect(tabs.nth(1)).toContainText('Vô địch');
    await expect(page.getByText('Đội chưa đá trận nào ở giải này.')).toBeVisible();

    await tabs.nth(1).click();

    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'GOAT Shuttle League 2026' })).toBeVisible();
    await expect(page.getByText('CLB Cầu Lông Phú Nhuận vs Gym FC')).toBeVisible();
    expect(matchRequests).toEqual(['t-autumn', 't-league']);
  });
});
