import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

const currentUserId = '11111111-1111-4111-8111-111111111111';
const opponentId = '66666666-6666-4666-8666-666666666666';

function futureDate(offsetDays: number): string {
  const value = new Date(Date.now() + offsetDays * 86_400_000);
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0')
  ].join('-');
}

function session(status: 'PROPOSED' | 'ACCEPTED_BY_ONE' | 'ACCEPTED' = 'PROPOSED') {
  return {
    sessionId: '77777777-7777-4777-8777-777777777777',
    sportType: 'BADMINTON',
    playDate: futureDate(1),
    startTime: '18:00:00',
    endTime: '20:00:00',
    timezone: 'Asia/Ho_Chi_Minh',
    compatibilityScore: 92.4,
    distanceKm: 2.3,
    eloDifference: 60,
    status,
    matchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    participants: [
      {
        participantProfileId: '88888888-8888-4888-8888-888888888888',
        participantId: currentUserId,
        participantType: 'PLAYER',
        name: 'Nguyễn Minh Anh',
        sportType: 'BADMINTON',
        eloRating: 1200,
        latitude: 10.77,
        longitude: 106.67,
        snapshotAt: new Date().toISOString()
      },
      {
        participantProfileId: '99999999-9999-4999-8999-999999999999',
        participantId: opponentId,
        participantType: 'PLAYER',
        name: 'Trần Hoàng Minh',
        sportType: 'BADMINTON',
        eloRating: 1260,
        latitude: 10.78,
        longitude: 106.68,
        snapshotAt: new Date().toISOString()
      }
    ],
    acceptances: status === 'ACCEPTED_BY_ONE'
      ? [{
        acceptanceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        participantProfileId: '88888888-8888-4888-8888-888888888888',
        decision: 'ACCEPTED',
        decidedAt: new Date().toISOString()
      }]
      : [],
    proposal: {
      proposalId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      designatedBookerId: currentUserId,
      venueId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      status: 'CREATED',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600_000).toISOString()
    }
  };
}

test.beforeEach(async ({ page }) => {
  await mockGoatSportsApi(page);
  await page.route('**/auth-service/api/v1/users/me/sport-profiles', route => route.fulfill({
    json: {
      data: [{
        profileId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        sportType: 'BADMINTON',
        skillLevel: 'INTERMEDIATE',
        eloRating: 1200,
        preferredPositions: [],
        playStyle: 'FAIR_PLAY',
        latitude: 10.77,
        longitude: 106.67,
        playRadiusKm: 15,
        winCount: 8,
        lossCount: 5,
        drawCount: 1,
        matchCount: 14,
        winRate: 0.571,
        availabilities: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }],
      statusCode: 200,
      message: null,
      error: null
    }
  }));
});

test('căn main và trợ lý theo cùng container với Trang chủ và Tìm sân', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.route('**/ai-service/api/v1/ai/matchmaking/status', route =>
    route.fulfill({ json: { status: 'NOT_IN_QUEUE' } })
  );
  await page.route('**/ai-service/api/v1/ai/matchmaking/sessions?**', route =>
    route.fulfill({ json: [] })
  );

  await page.goto('/matchmaking');
  await expect(page.locator('main.matchmaking-page')).toBeVisible({ timeout: 15_000 });

  const mainBox = await page.locator('main.matchmaking-page').boundingBox();
  const assistantBox = await page.locator('#ai-assistant-dialog').boundingBox();
  expect(mainBox).not.toBeNull();
  expect(assistantBox).not.toBeNull();
  expect(Math.round(mainBox!.x)).toBe(180);
  expect(Math.round(mainBox!.width)).toBe(1560);
  expect(Math.round(assistantBox!.x + assistantBox!.width)).toBe(1712);
});

test('hiển thị cấu hình từ hồ sơ và lịch sử ghép kèo thật', async ({ page }) => {
  await page.route('**/ai-service/api/v1/ai/matchmaking/status', route =>
    route.fulfill({ json: { status: 'NOT_IN_QUEUE' } })
  );
  await page.route('**/ai-service/api/v1/ai/matchmaking/sessions?**', route =>
    route.fulfill({ json: [session('ACCEPTED')] })
  );

  await page.goto('/matchmaking');

  await expect(page.locator('main h1')).toContainText('Ghép đúng kèo', { timeout: 15_000 });
  await expect(page.getByText('Đã dùng hồ sơ')).toBeVisible();
  await expect(page.getByRole('button', { name: /Fair-play/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Trần Hoàng Minh')).toBeVisible();
  await expect(page.getByText('Đã xác nhận')).toBeVisible();
});

test('tìm, nhận đề xuất và chấp nhận kèo end-to-end', async ({ page }) => {
  await page.route('**/ai-service/api/v1/ai/matchmaking/status', route =>
    route.fulfill({ json: { status: 'NOT_IN_QUEUE' } })
  );
  await page.route('**/ai-service/api/v1/ai/matchmaking/sessions?**', route =>
    route.fulfill({ json: [] })
  );
  await page.route('**/ai-service/api/v1/ai/matchmaking/queue', async route => {
    expect(route.request().method()).toBe('POST');
    const payload = route.request().postDataJSON();
    expect(payload.playStyle).toBe('FAIR_PLAY');
    expect(payload.latitude).toBe(10.77);
    expect(payload.maxDistanceKm).toBe(15);
    await route.fulfill({ json: { status: 'MATCHED', message: 'Đã tìm thấy đối thủ.', session: session() } });
  });
  await page.route('**/ai-service/api/v1/ai/matchmaking/sessions/*/acceptances', route =>
    route.fulfill({ json: session('ACCEPTED_BY_ONE') })
  );

  await page.goto('/matchmaking');
  const closeAssistant = page.getByRole('button', { name: 'Đóng trợ lý' });
  if (await closeAssistant.isVisible()) await closeAssistant.click();
  await page.getByRole('button', { name: 'Tìm đối thủ', exact: true }).click();
  await expect(page.getByRole('heading', { name: '92% phù hợp' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trần Hoàng Minh' })).toBeVisible();
  await expect(page.getByText('Phản hồi trong')).toBeVisible();

  await page.getByRole('button', { name: 'Chấp nhận kèo' }).click();
  await expect(page.getByText('Đang chờ đối thủ xác nhận')).toBeVisible();
});
