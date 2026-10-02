import { expect, test, type Page } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

// Trang chi tiet giai: chi luc mo dang ky moi doi doi hinh / rut doi; xem doi hinh doi khac; lich cuon vo han;
// tab Tong quan hai cot cung day.
const ok = (data: unknown) => ({ data, statusCode: 200, message: null, error: null });
const ME = '11111111-1111-4111-8111-111111111111';
const ID = 't0000000-0000-4000-8000-000000000099';

function day(offset: number): string {
  const value = new Date(Date.now() + offset * 86_400_000);
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
}

const line = (playerId: string, name: string, shirt: number, extra: Record<string, unknown> = {}) => ({
  lineupId: `l-${playerId}`, playerId, playerName: name, lineupRole: 'PLAYER', shirtNumber: shirt, memberStatus: 'ACCEPTED', ...extra
});

const teams = [
  { registrationId: 'r-mine', tournamentId: ID, type: 'TEAM', teamName: 'Code FC', registeredBy: ME, status: 'CONFIRMED',
    paymentStatus: 'SUCCEEDED', feeAmount: 0, lineups: [line(ME, 'Tôi', 10, { lineupRole: 'CAPTAIN' }),
      line('p2', 'Lê Văn Hậu', 7), line('p3', 'Trần Quốc Bảo', 9), line('p4', 'Phan Gia Huy', 11, { memberStatus: 'INVITED' })] },
  { registrationId: 'r-dragon', tournamentId: ID, type: 'TEAM', teamName: 'Rồng Xanh', registeredBy: 'q1', status: 'CONFIRMED',
    lineups: [line('q1', 'Vũ Đức Thịnh', 1, { lineupRole: 'CAPTAIN' }), line('q2', 'Đỗ Minh Khôi', 4), line('q3', 'Ngô Tấn Lộc', 8),
      line('q4', 'Mai Hữu Phước', 12, { memberStatus: 'DECLINED' })] },
  { registrationId: 'r-solo', tournamentId: ID, type: 'INDIVIDUAL', playerId: 's1', registeredBy: 's1', status: 'CONFIRMED', lineups: [] }
];

// 30 tran trong 3 ngay (10 tran/ngay), du lon de cuon vo han (moi lan 20).
const reservations = Array.from({ length: 30 }, (_, index) => ({
  reservationId: `res-${index}`, tournamentId: ID, venueId: 'v1', courtId: 'c1', bookingId: null,
  playDate: day(5 + Math.floor(index / 10)), startTime: `${String(7 + index % 10).padStart(2, '0')}:00:00`,
  endTime: `${String(8 + index % 10).padStart(2, '0')}:00:00`, status: 'CONFIRMED'
}));
const fixtures = reservations.map((slot, index) => ({
  fixtureId: `f-${index}`, tournamentId: ID, roundName: `Vòng ${Math.floor(index / 10) + 1}`, roundNumber: Math.floor(index / 10) + 1,
  matchNumber: index + 1, registration1Id: 'r-mine', registration2Id: 'r-dragon', reservationId: slot.reservationId, status: 'SCHEDULED'
}));

async function openDetail(page: Page, status: string) {
  await mockGoatSportsApi(page);
  const tournament = {
    tournamentId: ID, organizerId: 'o1', name: 'Giải Phong Trào Mùa Thu', sportType: 'FOOTBALL', format: 'ROUND_ROBIN', status,
    maxParticipants: 8, currentParticipants: 3, entryFee: 0, prizePool: 0, registrationOpenDate: day(-10), registrationCloseDate: day(2),
    startDate: day(5), endDate: day(7), rules: ['Đá 2 hiệp 20 phút'], participantType: 'TEAM', playFormat: 'FOOTBALL_5',
    rosterMin: 3, rosterMax: 5, courtIds: [], description: 'Giải giao hữu cuối tuần.'
  };
  await page.route(`**/club-service/api/v1/tournaments/${ID}**`, route => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith('/teams') ? teams : path.endsWith('/fixtures') ? fixtures
      : path.endsWith('/reservations') ? reservations : path.endsWith('/standings') || path.endsWith('/eligibility-rules') ? []
        : tournament;
    return route.fulfill({ json: ok(body) });
  });
  await page.goto(`/tournaments/${ID}`);
  await expect(page.getByRole('heading', { name: 'Giải Phong Trào Mùa Thu' })).toBeVisible();
}

test('mở đăng ký: đội trưởng mời thêm, bỏ thành viên, rút đội', async ({ page }) => {
  await openDetail(page, 'REGISTRATION_OPEN');
  const rail = page.locator('.rail');
  await expect(rail.getByRole('button', { name: 'Mời thêm' })).toBeVisible();
  await expect(rail.getByRole('button', { name: 'Rút đội khỏi giải' })).toBeVisible();
  await expect(rail.getByRole('button', { name: /^Bỏ .* khỏi đội$/ })).toHaveCount(3);
});

for (const status of ['REGISTRATION_CLOSED', 'IN_PROGRESS']) {
  test(`${status}: đội hình bị khóa, không mời / bỏ / rút`, async ({ page }) => {
    await openDetail(page, status);
    const rail = page.locator('.rail');
    await expect(rail.locator('.roster')).toContainText('Lê Văn Hậu');
    await expect(rail.getByRole('button', { name: 'Mời thêm' })).toHaveCount(0);
    await expect(rail.getByRole('button', { name: 'Rút đội khỏi giải' })).toHaveCount(0);
    await expect(rail.getByRole('button', { name: /^Bỏ .* khỏi đội$/ })).toHaveCount(0);
  });
}

test('xem đội hình đội khác; đăng ký cá nhân chưa có đội hình', async ({ page }) => {
  await openDetail(page, 'REGISTRATION_CLOSED');
  await page.getByRole('tab', { name: /Đội tham dự/ }).click();

  await page.getByRole('button', { name: 'Xem đội hình Rồng Xanh' }).click();
  const modal = page.locator('.modal--lineup');
  await expect(modal).toContainText('Rồng Xanh');
  await expect(modal.locator('app-lineup-pitch')).toBeVisible();
  // Nguoi da tu choi khong nam trong doi hinh cong khai.
  await expect(modal).not.toContainText('Mai Hữu Phước');
  await modal.getByRole('button', { name: 'Đóng' }).click();

  const solo = page.locator('.team-card').filter({ hasNot: page.locator('.team-card__avatar.is-club') });
  await solo.getByRole('button', { name: /^Xem đội hình/ }).click();
  await expect(modal).toContainText('Chưa công bố đội hình');
});

test('lịch thi đấu hiện dần khi cuộn', async ({ page }) => {
  await openDetail(page, 'IN_PROGRESS');
  await page.getByRole('tab', { name: /Lịch thi đấu/ }).click();
  const matches = page.locator('.fixture');
  await expect(matches).toHaveCount(20);
  await expect(page.locator('.match-day')).toHaveCount(2);
  await page.locator('.list-sentinel').scrollIntoViewIfNeeded();
  await expect(matches).toHaveCount(30);
  await expect(page.locator('.match-day')).toHaveCount(3);
  await expect(page.locator('.list-sentinel')).toHaveCount(0);
});

test('tổng quan: cột chính và cột phải cùng đáy', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'Một cột trên điện thoại.');
  await openDetail(page, 'REGISTRATION_OPEN');
  const main = await page.locator('.main').boundingBox();
  const rail = await page.locator('.rail').boundingBox();
  expect(Math.abs((main!.y + main!.height) - (rail!.y + rail!.height))).toBeLessThanOrEqual(1);
  const lastMain = await page.locator('.overview > :last-child').boundingBox();
  const lastRail = await page.locator('.rail > :last-child').boundingBox();
  expect(Math.abs((lastMain!.y + lastMain!.height) - (lastRail!.y + lastRail!.height))).toBeLessThanOrEqual(1);
});
