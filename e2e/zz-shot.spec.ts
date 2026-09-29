// Tạm: chụp ảnh trang AI ghép trận để soát giao diện. Xóa sau khi dùng.
import { test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

const S = 'C:/Users/HP/AppData/Local/Temp/claude/e--GoatSports/84b1153a-bd91-466f-a41e-8abd2d150923/scratchpad/';
const me = '11111111-1111-4111-8111-111111111111';

const completed = {
  sessionId: 'a0000000-0000-4000-8000-000000000002', sportType: 'BADMINTON', playDate: '2026-09-18',
  startTime: '16:00:00', endTime: '17:00:00', timezone: 'Asia/Ho_Chi_Minh', compatibilityScore: 52, distanceKm: 0,
  eloDifference: 300, status: 'COMPLETED', matchedAt: '2026-09-17T08:00:00Z', expiresAt: '2026-09-17T08:10:00Z',
  participants: [
    { participantProfileId: 'p1', participantId: me, participantType: 'PLAYER', name: 'Minh Đạt', sportType: 'BADMINTON', eloRating: 1200, latitude: 10.77, longitude: 106.67, snapshotAt: '2026-09-17T08:00:00Z' },
    { participantProfileId: 'p2', participantId: 'u2', participantType: 'PLAYER', name: 'Thắng Đạt', sportType: 'BADMINTON', eloRating: 1500, latitude: 10.77, longitude: 106.67, snapshotAt: '2026-09-17T08:00:00Z' }
  ],
  acceptances: [],
  proposal: { proposalId: 'pr', designatedBookerId: me, venueId: 'v1', status: 'COMPLETED', createdAt: '2026-09-17T08:00:00Z', expiresAt: '2026-09-17T08:10:00Z' },
  result: { participantOneScore: 1, participantTwoScore: 2, winnerId: 'u2', confirmedAt: '2026-09-18T18:00:00Z', eloUpdates: { [me]: 1194 }, eloApplied: true },
  feedback: []
};

test('shots', async ({ page }, info) => {
  test.setTimeout(120_000);
  const tag = info.project.name.includes('mobile') ? 'mobile' : 'desktop';
  await mockGoatSportsApi(page);
  await page.route('**/ai-service/api/v1/ai/matchmaking/status', route => route.fulfill({ json: { status: 'NOT_IN_QUEUE' } }));
  await page.route('**/ai-service/api/v1/ai/matchmaking/sessions?**', route => route.fulfill({ json: [completed] }));
  await page.goto('/matchmaking');
  await page.locator('.setup-card').waitFor({ timeout: 30_000 });
  const closeAssistant = page.getByRole('button', { name: 'Đóng trợ lý' });
  if (await closeAssistant.isVisible()) await closeAssistant.click();
  await page.locator('.history-row').first().click();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const top = document.querySelector('.insights__detail')!.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top - 90);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${S}v3-top-${tag}.png` });
});
