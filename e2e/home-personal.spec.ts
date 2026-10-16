import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

const me = '11111111-1111-4111-8111-111111111111';
const clubId = 'c1111111-1111-4111-8111-111111111111';
const venueId = 'f1111111-1111-4111-8111-111111111111';

function day(offset: number): string {
  const value = new Date(Date.now() + offset * 86_400_000);
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
}

const ok = (data: unknown) => ({ data, statusCode: 200, message: null, error: null });
const club = {
  clubId, ownerId: me, name: 'GOAT Badminton Club', sportType: 'BADMINTON', privacy: 'PUBLIC', approvalMode: 'AUTO',
  active: true, winCount: 4, lossCount: 2, drawCount: 0, matchCount: 6
};

function booking(id: string, status: string, playDate: string, startTime: string, extra: Record<string, unknown> = {}) {
  return {
    bookingId: id, venueId, venueCourtId: 'f2222222-2222-4222-8222-222222222222', playDate, startTime,
    endTime: `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, '0')}:30:00`, status, totalPrice: 300000,
    depositAmount: 90000, remainingAmount: 210000, bookingCode: `GS${id.slice(0, 4)}`, createdAt: new Date().toISOString(),
    venueName: 'Sân Cầu Lông Phú Nhuận', courtName: 'Sân 2', ...extra
  };
}

test.beforeEach(async ({ page }) => {
  await mockGoatSportsApi(page);
  await page.route('**/venue-service/api/v1/bookings/my-history**', route => route.fulfill({ json: ok({
    meta: { page: 0, pageSize: 30, pages: 1, total: 4 },
    result: [
      booking('b1111111-1111-4111-8111-111111111111', 'CONFIRMED', day(1), '19:00:00'),
      booking('b2222222-2222-4222-8222-222222222222', 'PENDING_PAYMENT', day(2), '07:00:00',
        { holdExpiresAt: new Date(Date.now() + 20 * 60_000).toISOString() }),
      booking('b3333333-3333-4333-8333-333333333333', 'COMPLETED', day(-3), '18:00:00'),
      booking('b4444444-4444-4444-8444-444444444444', 'COMPLETED', day(-10), '18:00:00')
    ]
  }) }));
  await page.route('**/ai-service/api/v1/ai/matchmaking/status', route => route.fulfill({ json: {
    status: 'PROPOSED',
    session: {
      sessionId: '77777777-7777-4777-8777-777777777777', sportType: 'BADMINTON', playDate: day(1),
      startTime: '17:00:00', endTime: '18:30:00', timezone: 'Asia/Ho_Chi_Minh', compatibilityScore: 90,
      distanceKm: 2, eloDifference: 40, status: 'PROPOSED', matchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 9 * 60_000).toISOString(),
      participants: [
        { participantProfileId: 'p1', participantId: me, participantType: 'PLAYER', name: 'Nguyễn Minh Anh', sportType: 'BADMINTON', eloRating: 1220 },
        { participantProfileId: 'p2', participantId: '66666666-6666-4666-8666-666666666666', participantType: 'PLAYER',
          name: 'Trần Hoàng Minh', sportType: 'BADMINTON', eloRating: 1260 }
      ],
      acceptances: [], resultClaims: [], feedback: [],
      proposal: { proposalId: 'x', designatedBookerId: me, status: 'CREATED', createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 9 * 60_000).toISOString() }
    }
  } }));
  await page.route('**/club-service/api/v1/clubs/me', route => route.fulfill({ json: ok([
    { membershipId: 'm1', role: 'OWNER', status: 'ACTIVE', club }
  ]) }));
  await page.route('**/club-service/api/v1/clubs/me/activities**', route => route.fulfill({ json: ok([
    { activityId: 'a1', clubId, title: 'Tập luyện tối thứ Năm', startAt: `${day(3)}T19:00:00`, endAt: `${day(3)}T21:00:00`, createdBy: me }
  ]) }));
  await page.route('**/club-service/api/v1/clubs/me/invitations', route => route.fulfill({ json: ok([
    { invitationId: 'i1', inviteeId: me, invitedBy: 'x', status: 'PENDING',
      club: { ...club, clubId: 'c2222222-2222-4222-8222-222222222222', name: 'Hà Nội Pickleball', sportType: 'PICKLEBALL' } }
  ]) }));
  await page.route('**/club-service/api/v1/tournaments/me**', route => route.fulfill({ json: ok({
    content: [{ tournamentId: 't1', organizerId: 'o', name: 'Giải Cầu Lông Mùa Thu', sportType: 'BADMINTON', format: 'KNOCKOUT',
      status: 'REGISTRATION_CLOSED', maxParticipants: 16, currentParticipants: 16, entryFee: 0, prizePool: 0,
      registrationOpenDate: day(-10), registrationCloseDate: day(-1), startDate: day(5), endDate: day(6), rules: [],
      dailyStartTime: '08:00:00' },
      // Dữ liệu thật: giải không đặt giờ mỗi ngày trả dailyStartTime = null (từng làm cả trang đứng ở khung chờ).
      { tournamentId: 't4', organizerId: 'o', name: 'Giải Tennis Cuối Tuần', sportType: 'TENNIS', format: 'KNOCKOUT',
        status: 'REGISTRATION_OPEN', maxParticipants: 8, currentParticipants: 3, entryFee: 0, prizePool: 0,
        registrationOpenDate: day(-1), registrationCloseDate: day(20), startDate: day(30), endDate: day(31), rules: [],
        dailyStartTime: null, dailyEndTime: null, playFormat: null, playFormatLabel: null }],
    page: { size: 10, number: 0, totalElements: 1, totalPages: 1 }
  }) }));
  await page.route('**/club-service/api/v1/tournaments/invitations/me', route => route.fulfill({ json: ok([]) }));
  await page.route('**/club-service/api/v1/tournaments/search**', route => route.fulfill({ json: ok({
    content: [
      { tournamentId: 't2', organizerId: 'o', name: 'GOAT Open Pickleball', sportType: 'PICKLEBALL', format: 'ROUND_ROBIN',
        status: 'REGISTRATION_OPEN', maxParticipants: 24, currentParticipants: 18, entryFee: 200000, prizePool: 5000000,
        registrationOpenDate: day(-5), registrationCloseDate: day(1), startDate: day(8), endDate: day(9), rules: [],
        playFormatLabel: 'Đôi' },
      { tournamentId: 't3', organizerId: 'o', name: 'Cúp Bóng Đá Phong Trào', sportType: 'FOOTBALL', format: 'KNOCKOUT',
        status: 'REGISTRATION_OPEN', maxParticipants: 12, currentParticipants: 5, entryFee: 0, prizePool: 0,
        registrationOpenDate: day(-2), registrationCloseDate: day(10), startDate: day(14), endDate: day(15), rules: [] },
      { tournamentId: 't5', organizerId: 'o', name: 'Giải Chưa Chốt Lịch', sportType: null, format: 'KNOCKOUT',
        status: 'REGISTRATION_OPEN', maxParticipants: 0, currentParticipants: 0, entryFee: null, prizePool: 0,
        registrationOpenDate: null, registrationCloseDate: null, startDate: null, endDate: null, rules: [] }
    ],
    page: { size: 3, number: 0, totalElements: 2, totalPages: 1 }
  }) }));
  await page.route('**/auth-service/api/v1/users/me/sport-profiles', route => route.fulfill({ json: ok([
    { profileId: 'sp1', sportType: 'BADMINTON', skillLevel: 'INTERMEDIATE', eloRating: 1220, preferredPositions: [],
      winCount: 9, lossCount: 4, drawCount: 1, matchCount: 14, winRate: 0.643, availabilities: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { profileId: 'sp2', sportType: 'FOOTBALL', skillLevel: 'BEGINNER', eloRating: 1000, preferredPositions: [],
      winCount: 1, lossCount: 2, drawCount: 0, matchCount: 3, winRate: 0.333, availabilities: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  ]) }));
});

test('Trang chủ khi đã đăng nhập: hôm nay, dành cho bạn và cộng đồng', async ({ page }, testInfo) => {
  // Có vị trí và 6 sân gần: dải "Sân đấu nổi bật" phải cuộn ngang thay vì cắt còn 4 sân.
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 12.2104, longitude: 109.1937 });
  await page.route('**/venue-service/api/v1/venues?**', route => route.fulfill({ json: ok({
    items: Array.from({ length: 6 }, (_, index) => ({
      venueId: `5555555${index}-5555-4555-8555-555555555555`, name: `Sân Nha Trang ${index + 1}`, description: '',
      openTime: '06:00:00', closeTime: '23:00:00', active: true, minPrice: 200_000, maxPrice: 200_000,
      averageRating: 4.5, totalReviews: 3, phone: '', email: '', address: 'Nha Trang', ward: '', district: '', city: 'Khánh Hòa',
      latitude: 12.21, longitude: 109.19, imageUrls: [], amenities: [], sportTypes: ['FOOTBALL'], totalCourts: 2,
      distanceKm: 0.2 + index
    })),
    total: 6, page: 0, pageSize: 8, totalPages: 1
  }) }));
  await page.goto('/home');

  const hero = page.locator('.today-hero');
  await expect(hero.locator('h1')).toContainText('Minh Anh');
  await expect(hero).toContainText('6 lịch sắp tới');
  await expect(page.locator('.agenda')).toContainText('Giải Tennis Cuối Tuần');
  // Kèo AI 17:00 ngày mai đến trước sân 19:00 nên là lịch kế tiếp.
  await expect(page.locator('.next-up')).toContainText('Kèo cầu lông với Trần Hoàng Minh');
  await expect(page.locator('.shortcut')).toHaveCount(4);

  const agenda = page.locator('.agenda');
  await expect(agenda.locator('.agenda__day h3').first()).toHaveText('Ngày mai');
  await expect(agenda).toContainText('Sân Cầu Lông Phú Nhuận');
  await expect(agenda).toContainText('Tập luyện tối thứ Năm');
  await expect(agenda).toContainText('GOAT Badminton Club');
  // Lịch chỉ hiện 6 mục gần nhất; giải đấu 5 ngày nữa vẫn nằm trong đó.
  await expect(agenda).toContainText('Giải Cầu Lông Mùa Thu');

  const tasks = page.locator('.tasks');
  await expect(tasks.locator('.count-pill')).toHaveText('4');
  await expect(tasks.locator('.task').first()).toContainText('Đối thủ đang chờ bạn phản hồi');
  await expect(tasks.locator('.task--urgent')).toHaveCount(2);
  await expect(tasks).toContainText('Thanh toán cọc để giữ sân');
  await expect(tasks).toContainText('Lời mời vào CLB Hà Nội Pickleball');
  await expect(tasks).toContainText('1 lời mời kết bạn');

  await expect(page.locator('.profile-card')).toHaveCount(2);
  await expect(page.locator('.profile-card').first()).toContainText('Cầu lông');
  await expect(page.locator('.profile-card__elo b').first()).toHaveText('1220');
  await expect(page.locator('.venue-row')).toHaveCount(1);
  await expect(page.locator('.venue-row')).toContainText('2 lần');

  const community = page.locator('app-home-community');
  await expect(community.locator('.row')).toContainText('Sắp tới: Tập luyện tối thứ Năm');
  await expect(community.locator('.tournament')).toHaveCount(3);
  await expect(community.locator('.tournament').nth(2)).toContainText('Chưa chốt ngày khởi tranh');
  await expect(community.locator('.tournament').first()).toContainText('Hết hạn ngày mai');
  await expect(community.locator('.tournament').first()).toContainText('200.000');
  await expect(community.locator('.post')).toContainText('Trần Hoàng Nam');

  // Bố cục: hai bảng cùng hàng cao bằng nhau; danh sách dài cuộn bên trong bảng thay vì kéo dài trang.
  if (testInfo.project.name.startsWith('desktop')) {
    const height = async (selector: string) => Math.round((await page.locator(selector).first().boundingBox())!.height);
    expect(await height('.agenda')).toBe(await height('.tasks'));
    expect(await height('.profiles')).toBe(await height('.venues'));
    const community = await Promise.all([0, 1, 2].map(async index =>
      Math.round((await page.locator('app-home-community .home-panel').nth(index).boundingBox())!.height)));
    expect(new Set(community).size).toBe(1);
    await expect(page.locator('.agenda__days')).toHaveCSS('overflow-y', 'auto');
    await expect(page.locator('.profile-grid')).toHaveCSS('overflow-x', 'auto');
    const strip = page.locator('.venue-grid').first();
    await expect(strip.locator('app-venue-card')).toHaveCount(6);
    await expect(strip).toHaveCSS('overflow-x', 'auto');
    expect(await strip.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  }

  await page.screenshot({ path: testInfo.outputPath('home-personal.png'), fullPage: true });
});

function nhaTrangVenue(id: string, name: string, distanceKm: number) {
  return {
    venueId: id, name, description: '', openTime: '06:00:00', closeTime: '23:00:00', active: true,
    minPrice: 200_000, maxPrice: 200_000, averageRating: 4.5, totalReviews: 3, phone: '', email: '',
    address: 'Nha Trang', ward: '', district: '', city: 'Khánh Hòa', latitude: 12.21, longitude: 109.19,
    imageUrls: [], amenities: [], sportTypes: ['FOOTBALL'], totalCourts: 2, distanceKm
  };
}

const near = nhaTrangVenue('a1111111-1111-4111-8111-111111111111', 'Sân Gần Nhà', 0.4);
const favourite = nhaTrangVenue('b2222222-2222-4222-8222-222222222222', 'Sân Quen Thuộc', 3.1);

test('trang chủ: "Dành cho bạn" theo AI kèm lý do, đổi sang "Gần nhất" được', async ({ page }) => {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 12.2104, longitude: 109.1937 });
  const aiRequests: URL[] = [];
  await page.route('**/ai-service/api/v1/ai/recommendations/venues**', route => {
    aiRequests.push(new URL(route.request().url()));
    return route.fulfill({ json: [
      { venueId: favourite.venueId, venueName: favourite.name, sportTypes: ['FOOTBALL'], address: '', distanceKm: 3.1,
        rating: 4.5, score: 91, matchReason: 'Tương đồng thói quen 92%, cách bạn 3.1 km và được đánh giá 4.5/5.',
        suggestedCourts: [] },
      { venueId: near.venueId, venueName: near.name, sportTypes: ['FOOTBALL'], address: '', distanceKm: 0.4,
        rating: 4.5, score: 70, matchReason: 'Tương đồng thói quen 40%, cách bạn 0.4 km và được đánh giá 4.5/5.',
        suggestedCourts: [] }
    ] });
  });
  // Cả tra theo id lẫn danh sách gần nhất đều trả theo khoảng cách: thứ tự "Dành cho bạn" phải lấy theo AI.
  await page.route('**/venue-service/api/v1/venues?**', route => route.fulfill({
    json: ok({ items: [near, favourite], total: 2, page: 0, pageSize: 8, totalPages: 1 })
  }));
  await page.goto('/home');

  const strip = page.locator('.venue-grid').first();
  await expect(strip.locator('app-venue-card').first()).toContainText('Sân Quen Thuộc');
  await expect(strip.locator('.venue-pick__reason').first()).toContainText('Tương đồng thói quen 92%');
  await expect(page.locator('#featured-venues-title + p')).toContainText('thói quen đặt và xem sân');
  expect(aiRequests[0].searchParams.get('sport_type')).toBe('FOOTBALL');
  expect(aiRequests[0].searchParams.get('radius_km')).toBe('10');
  await expect(page.getByRole('button', { name: 'Dành cho bạn' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Gần nhất' }).click();
  await expect(strip.locator('app-venue-card').first()).toContainText('Sân Gần Nhà');
  await expect(strip.locator('.venue-pick__reason')).toHaveCount(0);
});

test('trang chủ: AI lỗi thì vẫn hiện sân gần nhất', async ({ page }) => {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 12.2104, longitude: 109.1937 });
  await page.route('**/ai-service/api/v1/ai/recommendations/venues**', route => route.fulfill({ status: 503, json: {} }));
  await page.route('**/venue-service/api/v1/venues?**', route => route.fulfill({
    json: ok({ items: [near, favourite], total: 2, page: 0, pageSize: 8, totalPages: 1 })
  }));
  await page.goto('/home');

  const strip = page.locator('.venue-grid').first();
  await expect(strip.locator('app-venue-card')).toHaveCount(2);
  await expect(strip.locator('app-venue-card').first()).toContainText('Sân Gần Nhà');
  await expect(strip.locator('.venue-pick__reason')).toHaveCount(0);
});

test('tiêu đề "Sân đấu nổi bật" không bị thanh công cụ đè lên ở màn rộng', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop'), 'chỉ màn rộng mới đặt tiêu đề và công cụ cùng hàng');
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 12.2104, longitude: 109.1937 });
  await page.route('**/venue-service/api/v1/venues?**', route => route.fulfill({
    json: ok({ items: [near, favourite], total: 2, page: 0, pageSize: 8, totalPages: 1 })
  }));
  for (const width of [1440, 1536, 1700]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/home');
    const title = await page.locator('#featured-venues-title').boundingBox();
    const tools = await page.locator('.nearby-tools').boundingBox();
    expect(title && tools).toBeTruthy();
    // Cùng hàng thì công cụ phải bắt đầu sau mép phải tiêu đề.
    expect(tools!.x, `rộng ${width}px`).toBeGreaterThanOrEqual(title!.x + title!.width);
    await page.locator('.section-heading').first().screenshot({ path: testInfo.outputPath(`heading-${width}.png`) });
  }
});

test('trang chủ: vị trí đoán theo mạng (sai số lớn) được nói rõ, vị trí tự chọn được nhớ cho lần sau', async ({ page }) => {
  // Máy không GPS: trình duyệt trả tâm Hà Nội với sai số ~50 km dù người dùng đang ở Nha Trang.
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 21.0285, longitude: 105.8542, accuracy: 50_000 });
  await page.route('**/venues/geocoding/reverse**', route => {
    const latitude = Number(new URL(route.request().url()).searchParams.get('latitude') ?? 0);
    const address = latitude > 20 ? 'Hoàn Kiếm, Hà Nội' : 'Lộc Thọ, Nha Trang, Khánh Hòa';
    return route.fulfill({ json: ok({ latitude, longitude: 0, title: address, address }) });
  });
  const venueRequests: URL[] = [];
  await page.route('**/venue-service/api/v1/venues?**', route => {
    venueRequests.push(new URL(route.request().url()));
    return route.fulfill({ json: ok({ items: [], total: 0, page: 0, pageSize: 8, totalPages: 0 }) });
  });
  await page.goto('/home');

  await expect(page.locator('.location-approx')).toContainText('sai số ~50 km');
  await page.getByRole('button', { name: 'Đổi vị trí' }).click();
  await expect(page.locator('.location-picker__approx')).toContainText('ước lượng vị trí theo mạng');

  // Đặt ghim bằng tay: vị trí chính xác, hết cảnh báo, được nhớ.
  await page.locator('.location-picker__map').click({ position: { x: 120, y: 120 } });
  await expect(page.locator('.location-picker__approx')).toHaveCount(0);
  await page.getByRole('button', { name: 'Xác nhận vị trí' }).click();
  await expect(page.locator('.location-approx')).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('goat.home.location') || 'null'));
  expect(saved?.latitude).toBeGreaterThan(20);

  // Lần sau: dùng vị trí đã chọn, không hiện cảnh báo ước lượng.
  venueRequests.length = 0;
  await page.reload();
  await expect(page.locator('.current-location')).toContainText(saved.label);
  await expect(page.locator('.location-approx')).toHaveCount(0);
  await expect.poll(() => venueRequests.length).toBeGreaterThan(0);
  expect(Number(venueRequests[0].searchParams.get('latitude'))).toBeCloseTo(saved.latitude, 5);
});
