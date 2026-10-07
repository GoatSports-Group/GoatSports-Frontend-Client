import { expect, test, type Page } from '@playwright/test';
import { chatRoomsPage, mockGoatSportsApi } from './fixtures/api.fixture';

// Nut "Nhan tin" o trang giai dau va trang san: mo chat cong viec (BUSINESS) voi ban to chuc / chu san ngay tai trang
// dang xem, kem giai / san dang hoi de ho thay trong hop thu cong viec ben admin.
const ok = (data: unknown) => ({ json: { data, statusCode: 200, message: null, error: null } });
const ME = '11111111-1111-4111-8111-111111111111';
const HOST = '33333333-3333-4333-8333-333333333333';
const TOURNAMENT = 't0000000-0000-4000-8000-000000000123';
const VENUE = '17397670-2693-30f3-8188-baf3469fe5ec';

/** POST /conversations/business: chat cong viec voi chu san / ban to chuc, kem doi tuong dang hoi. */
async function routeBusiness(page: Page): Promise<Array<{ ownerId: string; subjectType: string; subjectId: string }>> {
  const requests: Array<{ ownerId: string; subjectType: string; subjectId: string }> = [];
  await page.route(url => url.pathname.endsWith('/social/conversations/business'), route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill(ok({ ...chatRoomsPage().content[0], type: 'BUSINESS' }));
  });
  return requests;
}

test('trang giải đấu: "Nhắn tin ban tổ chức" mở cửa sổ chat ngay tại trang', async ({ page }) => {
  await mockGoatSportsApi(page);
  const requests = await routeBusiness(page);
  await page.route(`**/club-service/api/v1/tournaments/${TOURNAMENT}**`, route => {
    const path = new URL(route.request().url()).pathname;
    const list = /\/(teams|fixtures|reservations|standings|eligibility-rules)$/.test(path);
    return route.fulfill(ok(list ? [] : {
      tournamentId: TOURNAMENT, organizerId: HOST, name: 'Giải Bóng Chuyền Tân Bình', sportType: 'VOLLEYBALL',
      format: 'ROUND_ROBIN', status: 'REGISTRATION_CLOSED', maxParticipants: 8, currentParticipants: 1, entryFee: 500000,
      prizePool: 4000000, registrationOpenDate: '2026-09-21', registrationCloseDate: '2026-10-01', startDate: '2026-10-04',
      endDate: '2026-10-06', rules: [], participantType: 'TEAM', courtIds: []
    }));
  });

  await page.goto(`/tournaments/${TOURNAMENT}`);
  await page.getByRole('button', { name: 'Nhắn tin ban tổ chức' }).click();
  const mini = page.getByRole('dialog', { name: 'Trần Hoàng Nam' });
  await expect(mini).toBeVisible();
  await expect(mini.getByRole('textbox', { name: 'Nội dung tin nhắn' })).toBeVisible();
  expect(requests).toEqual([{ ownerId: HOST, subjectType: 'TOURNAMENT', subjectId: TOURNAMENT }]);
});

test('ban tổ chức xem giải của chính mình thì không có nút nhắn tin', async ({ page }) => {
  await mockGoatSportsApi(page);
  await page.route(`**/club-service/api/v1/tournaments/${TOURNAMENT}**`, route => {
    const path = new URL(route.request().url()).pathname;
    const list = /\/(teams|fixtures|reservations|standings|eligibility-rules)$/.test(path);
    return route.fulfill(ok(list ? [] : {
      tournamentId: TOURNAMENT, organizerId: ME, name: 'Giải của tôi', sportType: 'VOLLEYBALL', format: 'ROUND_ROBIN',
      status: 'REGISTRATION_OPEN', maxParticipants: 8, currentParticipants: 0, entryFee: 0, prizePool: 0,
      registrationOpenDate: '2026-09-21', registrationCloseDate: '2026-10-21', startDate: '2026-10-24', endDate: '2026-10-26',
      rules: [], participantType: 'TEAM', courtIds: []
    }));
  });
  await page.goto(`/tournaments/${TOURNAMENT}`);
  await expect(page.getByRole('heading', { name: 'Giải của tôi' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nhắn tin ban tổ chức' })).toHaveCount(0);
});

test('trang sân: "Nhắn tin" mở chat với chủ sân', async ({ page }) => {
  await mockGoatSportsApi(page);
  const requests = await routeBusiness(page);
  await page.route(`**/venue-service/api/v1/venues/${VENUE}`, route => route.fulfill(ok({
    venueId: VENUE, ownerId: HOST, name: 'GOAT Arena', address: '137 Tân Xuân', city: 'Hà Nội', openTime: '06:00:00',
    closeTime: '22:00:00', active: true, minPrice: 150000, maxPrice: 200000, averageRating: 0, totalReviews: 0,
    imageUrls: [], amenities: [], sportTypes: [], courts: []
  })));

  await page.goto(`/venues/${VENUE}`);
  await page.locator('.heading-actions').getByRole('button', { name: 'Nhắn tin' }).click();
  await expect(page.getByRole('dialog', { name: 'Trần Hoàng Nam' })).toBeVisible();
  expect(requests).toEqual([{ ownerId: HOST, subjectType: 'VENUE', subjectId: VENUE }]);
});
