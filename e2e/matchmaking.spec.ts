import { Page, expect, test } from '@playwright/test';
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

function futureDay(offsetDays: number): string {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return days[new Date(Date.now() + offsetDays * 86_400_000).getDay()];
}

type TestSessionStatus = 'PROPOSED' | 'ACCEPTED_BY_ONE' | 'ACCEPTED' | 'VENUE_SELECTED'
  | 'BOOKING_PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'RESULT_PENDING' | 'COMPLETED'
  | 'DISPUTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

function session(status: TestSessionStatus = 'PROPOSED', sportType = 'BADMINTON') {
  return {
    sessionId: '77777777-7777-4777-8777-777777777777',
    sportType,
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
        sportType,
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
        sportType,
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

/** Nhảy thẳng tới bước cuối (Tiêu chí ghép), nơi có nút tìm đối thủ. */
async function openLastStep(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Tiêu chí ghép/ }).click();
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
        availabilities: [{
          availabilityId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          dayOfWeek: futureDay(2),
          startTime: '06:30:00',
          endTime: '08:00:00',
          timezone: 'Asia/Ho_Chi_Minh',
          active: true
        }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }],
      statusCode: 200,
      message: null,
      error: null
    }
  }));
});

test('main dùng toàn bộ container và trợ lý nổi không chiếm cột layout', async ({ page }, testInfo) => {
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
  const assistant = page.locator('#ai-assistant-dialog');
  const launcher = page.getByRole('button', { name: 'Mở trợ lý GOAT AI' });
  expect(mainBox).not.toBeNull();
  expect(Math.round(mainBox!.x)).toBe(180);
  expect(Math.round(mainBox!.width)).toBe(1560);
  await expect(launcher).toBeVisible();
  await expect(assistant).toBeHidden();

  await launcher.click();
  await expect(assistant).toBeVisible();
  const assistantBox = await assistant.boundingBox();
  const headBox = await page.locator('.page-head').boundingBox();
  const stageBox = await page.locator('.stage').boundingBox();
  const insightColumns = await page.locator('.insights').evaluate(element =>
    getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
  );

  expect(assistantBox).not.toBeNull();
  expect(headBox).not.toBeNull();
  expect(Math.round(assistantBox!.x + assistantBox!.width)).toBe(1898);
  expect(headBox!.width).toBeGreaterThan(1490);
  // Hàng 1: thiết lập kèo rộng cả trang; hàng 2: tiêu chí AI và lịch sử chia đôi.
  expect(stageBox!.width).toBeGreaterThan(1490);
  expect(insightColumns).toBe(2);
});

test('hiển thị cấu hình từ hồ sơ và lịch sử ghép kèo thật', async ({ page }) => {
  await page.route('**/ai-service/api/v1/ai/matchmaking/status', route =>
    route.fulfill({ json: { status: 'NOT_IN_QUEUE' } })
  );
  await page.route('**/ai-service/api/v1/ai/matchmaking/sessions?**', route =>
    route.fulfill({ json: [session('ACCEPTED')] })
  );

  await page.goto('/matchmaking');

  await expect(page.locator('main h1')).toContainText('AI ghép trận', { timeout: 15_000 });
  await expect(page.getByText('Đã dùng hồ sơ')).toBeVisible();
  // Đánh đơn: ba bước, mỗi bước tóm tắt lựa chọn ngay dưới tên bước.
  await expect(page.locator('.stepper li')).toHaveCount(3);
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(page.locator('#match-date')).toHaveValue(futureDate(2));
  await expect(page.locator('#match-start')).toHaveValue('06:30');
  await expect(page.locator('#match-end')).toHaveValue('08:00');
  await expect(page.getByRole('button', { name: /Thời gian & nơi chơi/ })).toContainText('06:30–08:00');
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(page.getByRole('button', { name: /^Fair-play/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#match-elo')).toHaveAttribute('readonly', '');
  await expect(page.getByText('Trần Hoàng Minh')).toBeVisible();
  await expect(page.getByText('Đã xác nhận')).toBeVisible();

  // Chọn một kèo trong lịch sử: chi tiết thay chỗ form ở hàng trên, đóng lại thì form quay về đúng bước.
  await page.locator('.history-row').click();
  await expect(page.locator('.result-state--matched .match-header')).toContainText('Cầu lông');
  await page.getByRole('button', { name: /Đóng chi tiết/ }).click();
  await expect(page.getByRole('button', { name: /^Fair-play/ })).toBeVisible();
});

test('chặn khung giờ trùng trận sắp tới và mở lại khi hết khoảng đệm', async ({ page }) => {
  const upcoming = session('CONFIRMED');
  upcoming.playDate = futureDate(2);
  upcoming.startTime = '06:30:00';
  upcoming.endTime = '08:00:00';

  await page.route('**/ai-service/api/v1/ai/matchmaking/status', route =>
    route.fulfill({ json: { status: 'NOT_IN_QUEUE' } })
  );
  await page.route('**/ai-service/api/v1/ai/matchmaking/sessions?**', route =>
    route.fulfill({ json: [upcoming] })
  );

  await page.goto('/matchmaking');
  const searchButton = page.getByRole('button', { name: 'Tìm đối thủ khác', exact: true });
  await expect(page.getByText('Khung giờ này đang bị giữ')).toBeVisible({ timeout: 15_000 });
  await openLastStep(page);
  await expect(searchButton).toBeDisabled();

  await page.getByRole('button', { name: /Thời gian & nơi chơi/ }).click();
  await page.locator('#match-start').fill('09:00');
  await page.locator('#match-end').fill('10:30');
  await expect(page.getByText('Khung giờ này đang bị giữ')).toBeHidden();
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(searchButton).toBeEnabled();

  await page.locator('.history-row').click();
  await expect(page.locator('.match-progress-wrap')).toHaveCSS('--progress', '60%');
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
  await openLastStep(page);
  await page.getByRole('button', { name: 'Tìm đối thủ', exact: true }).click();
  await expect(page.getByRole('heading', { name: '92% phù hợp' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trần Hoàng Minh' })).toBeVisible();
  await expect(page.getByText('Phản hồi trong')).toBeVisible();

  await page.getByRole('button', { name: 'Chấp nhận kèo' }).click();
  await expect(page.getByText('Đang chờ đối thủ xác nhận')).toBeVisible();
});

test('không polling trạng thái khi đang chờ đối thủ', async ({ page }) => {
  let statusRequests = 0;
  await page.route('**/ai-service/api/v1/ai/matchmaking/status', route => {
    statusRequests += 1;
    return route.fulfill({ json: { status: 'NOT_IN_QUEUE' } });
  });
  await page.route('**/ai-service/api/v1/ai/matchmaking/sessions?**', route =>
    route.fulfill({ json: [] })
  );
  await page.route('**/ai-service/api/v1/ai/matchmaking/queue', route =>
    route.fulfill({ json: { status: 'QUEUED', message: 'Đang chờ đối thủ phù hợp.', queueSize: 1 } })
  );

  await page.goto('/matchmaking');
  await openLastStep(page);
  await page.getByRole('button', { name: 'Tìm đối thủ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'GOAT AI đang quét đối thủ phù hợp' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hủy tìm kiếm' })).toBeVisible();

  await page.waitForTimeout(3_500);
  expect(statusRequests).toBe(1);
});

test.describe('hình thức thi đấu', () => {
  const ok = (data: unknown) => ({ json: { statusCode: 200, message: 'OK', data } });
  const partnerId = '12121212-1212-4212-8212-121212121212';
  const leaderId = '34343434-3434-4343-8343-343434343434';

  test.beforeEach(async ({ page }) => {
    await page.route('**/ai-service/api/v1/ai/matchmaking/status', route =>
      route.fulfill({ json: { status: 'NOT_IN_QUEUE' } }));
    await page.route('**/ai-service/api/v1/ai/matchmaking/sessions?**', route => route.fulfill({ json: [] }));
  });

  test('đánh đôi: chọn bạn cặp từ bạn bè; bạn cặp là thành viên của bên mình', async ({ page }) => {
    await page.route(/\/social-service\/api\/v1\/social\/friends(\?.*)?$/, route => route.fulfill(ok([
      { friendshipId: 'f-1', requesterId: currentUserId, addresseeId: partnerId, status: 'ACCEPTED', requestedAt: '2026-09-01T08:00:00' },
      { friendshipId: 'f-2', requesterId: currentUserId, addresseeId: opponentId, status: 'PENDING', requestedAt: '2026-09-02T08:00:00' }
    ])));
    await page.route(`**/auth-service/api/v1/users/${partnerId}`, route => route.fulfill(ok({
      userId: partnerId, username: 'le_thu', fullName: 'Lê Thu', email: 'thu@goatsports.test', status: 'ACTIVE'
    })));
    // Bạn cặp của mình đứng tên cặp (participantId = người rủ), mình nằm trong members.
    const pairSession = session();
    pairSession.participants[0] = {
      ...pairSession.participants[0], participantId: leaderId, name: 'Lê Thu & Nguyễn Minh Anh',
      members: [
        { userId: leaderId, name: 'Lê Thu', eloRating: 1180 },
        { userId: currentUserId, name: 'Nguyễn Minh Anh', eloRating: 1220 }
      ]
    } as typeof pairSession.participants[0];
    let payload: Record<string, unknown> | null = null;
    await page.route('**/ai-service/api/v1/ai/matchmaking/queue', async route => {
      payload = route.request().postDataJSON();
      await route.fulfill({ json: { status: 'MATCHED', message: 'Đã tìm thấy đối thủ.', session: pairSession } });
    });

    await page.goto('/matchmaking');
    const closeAssistant = page.getByRole('button', { name: 'Đóng trợ lý' });
    if (await closeAssistant.isVisible()) await closeAssistant.click();
    await page.getByRole('radio', { name: /Đánh đôi/ }).click();
    await expect(page.locator('.stepper li')).toHaveCount(4);
    await page.getByRole('button', { name: 'Tiếp tục' }).click();
    // Chưa chọn bạn cặp thì không qua được bước Đồng đội, cũng không nhảy cóc được.
    await page.getByRole('button', { name: 'Tiếp tục' }).click();
    await expect(page.getByText('Đánh đôi cần chọn bạn cặp')).toBeVisible();
    await expect(page.getByRole('button', { name: /Tiêu chí ghép/ })).toBeDisabled();

    await page.getByRole('tab', { name: 'Đăng tìm người' }).click();
    await expect(page.getByRole('link', { name: /Đăng tìm người chơi/ })).toHaveAttribute('href', /compose=find-players/);

    // Chỉ bạn đã kết bạn mới chọn được (lời mời đang chờ không có trong danh sách).
    await page.getByRole('tab', { name: 'Bạn bè' }).click();
    const people = page.locator('.people-list .person');
    await expect(people).toHaveText([/Lê Thu/]);
    await people.first().click();
    await expect(page.locator('.team-roster')).toContainText('Lê Thu');
    await expect(page.locator('.team-roster header')).toContainText('2/2');
    await openLastStep(page);
    await page.getByRole('button', { name: 'Tìm đối thủ', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Trần Hoàng Minh' })).toBeVisible();
    expect(payload).toMatchObject({ playFormat: 'BADMINTON_DOUBLES', partnerIds: [partnerId] });
    await expect(page.getByRole('heading', { name: 'Lê Thu & Nguyễn Minh Anh' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chấp nhận kèo' })).toBeVisible();
  });

  test('bóng đá: đại diện CLB chỉ liệt kê CLB bóng đá mình là chủ hoặc quản lý', async ({ page }) => {
    const club = (clubId: string, name: string, sportType: string) => ({
      clubId, name, sportType, ownerId: currentUserId, privacy: 'PUBLIC', approvalMode: 'MANUAL', active: true,
      winCount: 0, lossCount: 0, drawCount: 0, matchCount: 0, winRate: 0, memberCount: 9, tags: []
    });
    await page.route('**/club-service/api/v1/clubs/me', route => route.fulfill(ok([
      { membershipId: 'm-1', role: 'OWNER', status: 'ACTIVE', club: club('c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1', 'FC Bến Nghé', 'FOOTBALL') },
      { membershipId: 'm-2', role: 'MEMBER', status: 'ACTIVE', club: club('c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2', 'FC Thảo Điền', 'FOOTBALL') },
      { membershipId: 'm-3', role: 'ADMIN', status: 'ACTIVE', club: club('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'Cầu lông Q1', 'BADMINTON') }
    ])));
    let payload: Record<string, unknown> | null = null;
    await page.route('**/ai-service/api/v1/ai/matchmaking/queue', async route => {
      payload = route.request().postDataJSON();
      await route.fulfill({ json: { status: 'QUEUED', message: 'Đang chờ đối thủ phù hợp.', queueSize: 1 } });
    });

    // Chưa có hồ sơ bóng đá nên trang lấy vị trí từ trình duyệt.
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 10.77, longitude: 106.67 });
    await page.goto('/matchmaking');
    const closeAssistant = page.getByRole('button', { name: 'Đóng trợ lý' });
    if (await closeAssistant.isVisible()) await closeAssistant.click();
    await page.getByRole('button', { name: 'Bóng đá' }).click();

    await expect(page.getByRole('radio')).toHaveText([/Sân 5/, /Sân 7/, /Sân 11/]);
    // Bước 1 cho thấy CLB bóng đá mình đang ở (cả CLB chỉ là thành viên).
    await expect(page.locator('.club-hint')).toContainText('FC Bến Nghé');
    await expect(page.locator('.club-hint')).toContainText('FC Thảo Điền');
    await page.getByRole('radio', { name: /Sân 7/ }).click();
    await page.getByRole('button', { name: 'Tiếp tục' }).click();

    // Đại diện CLB: chỉ CLB mình là chủ hoặc quản lý, chọn sẵn khi chỉ có một.
    await page.getByRole('tab', { name: 'Đại diện CLB' }).click();
    const clubPicker = page.getByRole('button', { name: 'Câu lạc bộ thi đấu' });
    await expect(clubPicker).toContainText('FC Bến Nghé');
    await clubPicker.click();
    await expect(page.getByRole('option')).toHaveText(['FC Bến Nghé']);
    await page.keyboard.press('Escape');
    await openLastStep(page);
    await page.getByRole('button', { name: 'Tìm đối thủ', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'GOAT AI đang quét đối thủ phù hợp' })).toBeVisible();
    expect(payload).toMatchObject({ sportType: 'FOOTBALL', playFormat: 'FOOTBALL_7', clubId: 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1' });
    expect(payload).not.toHaveProperty('partnerIds');
  });

  test('bóng rổ 3x3 không đại diện CLB: ghép đội từ thành viên CLB và bạn bè', async ({ page }) => {
    const clubId = 'c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4';
    const clubmateId = '56565656-5656-4565-8565-565656565656';
    await page.route('**/club-service/api/v1/clubs/me', route => route.fulfill(ok([{
      membershipId: 'm-4', role: 'MEMBER', status: 'ACTIVE',
      club: { clubId, name: 'Rổ Quận 3', sportType: 'BASKETBALL', ownerId: leaderId, privacy: 'PUBLIC', approvalMode: 'MANUAL',
        active: true, winCount: 0, lossCount: 0, drawCount: 0, matchCount: 0, winRate: 0, memberCount: 6, tags: [] }
    }])));
    await page.route(`**/club-service/api/v1/clubs/${clubId}/members`, route => route.fulfill(ok([
      { membershipId: 'x-1', clubId, userId: currentUserId, role: 'MEMBER', status: 'ACTIVE' },
      { membershipId: 'x-2', clubId, userId: clubmateId, role: 'MEMBER', status: 'ACTIVE' },
      { membershipId: 'x-3', clubId, userId: opponentId, role: 'MEMBER', status: 'PENDING' }
    ])));
    await page.route(/\/social-service\/api\/v1\/social\/friends(\?.*)?$/, route => route.fulfill(ok([
      { friendshipId: 'f-1', requesterId: currentUserId, addresseeId: partnerId, status: 'ACCEPTED', requestedAt: '2026-09-01T08:00:00' }
    ])));
    for (const [userId, fullName] of [[clubmateId, 'Phan Quốc Bảo'], [partnerId, 'Lê Thu']]) {
      await page.route(`**/auth-service/api/v1/users/${userId}`, route => route.fulfill(ok({
        userId, username: userId.slice(0, 6), fullName, email: `${userId.slice(0, 6)}@goatsports.test`, status: 'ACTIVE'
      })));
    }
    let payload: Record<string, unknown> | null = null;
    await page.route('**/ai-service/api/v1/ai/matchmaking/queue', async route => {
      payload = route.request().postDataJSON();
      await route.fulfill({ json: { status: 'QUEUED', message: 'Đang chờ đối thủ phù hợp.', queueSize: 1 } });
    });
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 10.77, longitude: 106.67 });

    await page.goto('/matchmaking');
    const closeAssistant = page.getByRole('button', { name: 'Đóng trợ lý' });
    if (await closeAssistant.isVisible()) await closeAssistant.click();
    await page.getByRole('button', { name: 'Bóng rổ' }).click();
    await page.getByRole('button', { name: 'Tiếp tục' }).click();

    // Đang ở CLB bóng rổ nên mặc định chọn trong CLB; thành viên chưa duyệt và chính mình không có trong danh sách.
    await expect(page.getByRole('tab', { name: 'Thành viên CLB' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Đại diện CLB' })).toHaveCount(0);
    const people = page.locator('.people-list .person');
    await expect(people).toHaveText([/Phan Quốc Bảo/]);
    await people.first().click();
    await page.getByRole('tab', { name: 'Bạn bè' }).click();
    await people.first().click();
    await expect(page.locator('.team-roster header')).toContainText('3/3');
    await openLastStep(page);
    await page.getByRole('button', { name: 'Tìm đối thủ', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'GOAT AI đang quét đối thủ phù hợp' })).toBeVisible();
    expect(payload).toMatchObject({
      sportType: 'BASKETBALL', playFormat: 'BASKETBALL_3X3', partnerIds: [clubmateId, partnerId], teammateClubId: clubId
    });
    expect(payload).not.toHaveProperty('clubId');
  });
});

test('khung giờ là khoảng rảnh: mỗi sân gợi ý hiện giờ thi đấu là một slot trong khung chung', async ({ page }) => {
  const accepted = session('ACCEPTED');
  const withOptions = {
    ...accepted,
    proposal: {
      ...accepted.proposal,
      venueId: undefined,
      venueSearchStatus: 'READY',
      venueOptions: [{
        venueId: 'dddddddd-0000-4000-8000-000000000001', venueCourtId: 'dddddddd-0000-4000-8000-000000000002',
        venueName: 'Nhà thi đấu Phú Thọ', address: 'Quận 11', distanceKm: 2.1, rating: 4.6, score: 88,
        matchReason: 'Còn trống 19:00–20:00. Được đánh giá 4.6/5.', suggestedCourts: ['Sân 2'],
        slotStart: '19:00:00', slotEnd: '20:00:00'
      }]
    }
  };
  await page.route('**/ai-service/api/v1/ai/matchmaking/status', route =>
    route.fulfill({ json: { status: 'ACCEPTED', session: withOptions } }));
  await page.route('**/ai-service/api/v1/ai/matchmaking/sessions?**', route => route.fulfill({ json: [withOptions] }));
  await page.route('**/ai-service/api/v1/ai/matchmaking/sessions/*', route => route.fulfill({ json: withOptions }));

  await page.goto('/matchmaking');
  const closeAssistant = page.getByRole('button', { name: 'Đóng trợ lý' });
  if (await closeAssistant.isVisible()) await closeAssistant.click();
  await page.locator('.history-row').click();

  await expect(page.getByText('Khung rảnh chung')).toBeVisible();
  await expect(page.getByText('18:00–20:00').first()).toBeVisible();
  await expect(page.getByText('Thi đấu 19:00–20:00')).toBeVisible();
  // Kèo đang chạy: quay về form bằng "Tạo kèo mới", kèo vẫn nằm trong lịch sử.
  await page.getByRole('button', { name: 'Tạo kèo mới' }).click();
  await expect(page.locator('.setup-card')).toBeVisible();
  await expect(page.locator('.history-row')).toHaveCount(1);
});
