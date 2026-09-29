// Tạm: chụp ảnh trang AI ghép trận để soát giao diện. Xóa sau khi dùng.
import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

const S = 'C:/Users/HP/AppData/Local/Temp/claude/e--GoatSports/84b1153a-bd91-466f-a41e-8abd2d150923/scratchpad/';
const me = '11111111-1111-4111-8111-111111111111';
const ok = (data: unknown) => ({ json: { statusCode: 200, message: 'OK', data } });
const clubId = 'c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4';

function day(offset: number): string {
  const d = new Date(Date.now() + offset * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function session(id: string, status: string, rival: string, elo: number, offset: number) {
  return {
    sessionId: id, sportType: 'BADMINTON', playDate: day(offset), startTime: '18:00:00', endTime: '20:00:00',
    timezone: 'Asia/Ho_Chi_Minh', compatibilityScore: 88.2, distanceKm: 3.1, eloDifference: 40, status,
    matchedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600_000).toISOString(),
    participants: [
      { participantProfileId: `p1-${id}`, participantId: me, participantType: 'PLAYER', name: 'Nguyễn Minh Anh', sportType: 'BADMINTON', eloRating: 1200, latitude: 10.77, longitude: 106.67, snapshotAt: new Date().toISOString() },
      { participantProfileId: `p2-${id}`, participantId: `u-${id}`, participantType: 'PLAYER', name: rival, sportType: 'BADMINTON', eloRating: elo, latitude: 10.78, longitude: 106.68, snapshotAt: new Date().toISOString() }
    ],
    acceptances: [],
    proposal: { proposalId: `pr-${id}`, designatedBookerId: me, status: 'CREATED', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600_000).toISOString() }
  };
}

const history = [
  session('a0000000-0000-4000-8000-000000000001', 'CANCELLED', 'Đinh Hoàng Long & Lê Hoàng Nam', 1326, -1),
  session('a0000000-0000-4000-8000-000000000002', 'COMPLETED', 'Thắng Đạt', 1500, -8),
  session('a0000000-0000-4000-8000-000000000003', 'EXPIRED', 'Phạm Gia Bảo', 1180, -9),
  session('a0000000-0000-4000-8000-000000000004', 'REJECTED', 'Võ Thị Mai', 1240, -10),
  session('a0000000-0000-4000-8000-000000000005', 'CANCELLED', 'Trần Quốc Việt', 1210, -11)
];

test('shots', async ({ page }, info) => {
  test.setTimeout(120_000);
  const tag = info.project.name.includes('mobile') ? 'mobile' : 'desktop';
  await mockGoatSportsApi(page);
  await page.route('**/ai-service/api/v1/ai/matchmaking/status', route => route.fulfill({ json: { status: 'NOT_IN_QUEUE' } }));
  await page.route('**/ai-service/api/v1/ai/matchmaking/sessions?**', route => route.fulfill({ json: history }));
  await page.route('**/ai-service/api/v1/ai/matchmaking/queue', route => route.fulfill({ json: {
    status: 'MATCHED', message: 'ok', session: session('b0000000-0000-4000-8000-000000000009', 'PROPOSED', 'Lâm Tuấn Kiệt', 1230, 1)
  } }));
  await page.route('**/club-service/api/v1/clubs/me', route => route.fulfill(ok([
    { membershipId: 'm-1', role: 'MEMBER', status: 'ACTIVE', club: { clubId, name: 'CLB Cầu Lông Phú Nhuận', sportType: 'BADMINTON', ownerId: 'x', privacy: 'PUBLIC', approvalMode: 'MANUAL', active: true, winCount: 0, lossCount: 0, drawCount: 0, matchCount: 0, winRate: 0, memberCount: 6, tags: [] } }
  ])));
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 10.77, longitude: 106.67 });

  await page.goto('/matchmaking');
  await page.locator('.setup-card').waitFor({ timeout: 30_000 });
  const closeAssistant = page.getByRole('button', { name: 'Đóng trợ lý' });
  if (await closeAssistant.isVisible()) await closeAssistant.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${S}v2-1-${tag}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Bóng rổ' }).click();
  await page.locator('.setup-card').screenshot({ path: `${S}v2-2-${tag}.png` });

  // Chọn một kèo trong lịch sử: hiện ở cột trái.
  await page.locator('.history-row').nth(1).click();
  await page.waitForTimeout(400);
  await page.locator('.insights').screenshot({ path: `${S}v2-3-${tag}.png` });
  await page.getByRole('button', { name: /Đóng chi tiết/ }).click();

  // Tìm đối thủ: hàng trên hiện kèo tìm thấy; chọn lịch sử vẫn hiện bên trái, hàng trên giữ nguyên.
  await page.getByRole('button', { name: 'Cầu lông', exact: true }).click();
  await page.getByRole('button', { name: /Tiêu chí ghép/ }).click();
  await page.getByRole('button', { name: 'Tìm đối thủ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lâm Tuấn Kiệt' })).toBeVisible();
  await page.locator('.history-row').nth(2).click();
  await expect(page.locator('.stage').getByRole('heading', { name: 'Lâm Tuấn Kiệt' })).toBeVisible();
  await expect(page.locator('.insights').getByRole('heading', { name: 'Thắng Đạt' })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${S}v2-4-${tag}.png`, fullPage: true });
});
