import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

const ok = (data: unknown) => ({ data, statusCode: 200, message: null, error: null });

function day(offset: number): string {
  const value = new Date(Date.now() + offset * 86_400_000);
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
}

const tournaments = [
  { tournamentId: 't1', organizerId: 'o', name: 'GOAT Open Pickleball', sportType: 'PICKLEBALL', format: 'ROUND_ROBIN',
    status: 'REGISTRATION_OPEN', maxParticipants: 24, currentParticipants: 18, entryFee: 200000, prizePool: 0,
    registrationOpenDate: day(-3), registrationCloseDate: day(1), startDate: day(8), endDate: day(9), rules: [], playFormatLabel: 'Đôi' },
  { tournamentId: 't2', organizerId: 'o', name: 'Cúp Bóng Đá Phong Trào', sportType: 'FOOTBALL', format: 'KNOCKOUT',
    status: 'REGISTRATION_OPEN', maxParticipants: 12, currentParticipants: 5, entryFee: 0, prizePool: 0,
    registrationOpenDate: null, registrationCloseDate: null, startDate: null, endDate: null, rules: [] }
];
const clubs = ['GOAT Badminton', 'Saigon Smash', 'Weekend Club'].map((name, index) => ({
  clubId: `c${index}`, ownerId: 'o', name, sportType: index ? 'FOOTBALL' : 'BADMINTON', privacy: 'PUBLIC', approvalMode: 'AUTO',
  active: true, winCount: 0, lossCount: 0, drawCount: 0, matchCount: 0, winRate: 0, memberCount: 30 - index * 7,
  location: 'TP. Hồ Chí Minh', eloRating: index ? null : 1260
}));

test.beforeEach(async ({ page }) => {
  await mockGoatSportsApi(page);
  // Khách: phiên đăng nhập không tồn tại.
  await page.route(/auth-service\/api\/v1\/auth\/(me|refresh)/, route => route.fulfill({ status: 401, json: { statusCode: 401 } }));
  await page.route('**/venue-service/api/v1/venues?**', route => route.fulfill({ json: ok({
    items: [], total: 42, page: 0, pageSize: 1, totalPages: 42
  }) }));
  await page.route('**/club-service/api/v1/clubs/search**', route => route.fulfill({ json: ok({
    content: clubs, page: { size: 50, number: 0, totalElements: clubs.length, totalPages: 1 }
  }) }));
  await page.route('**/club-service/api/v1/tournaments/search**', route => route.fulfill({ json: ok({
    content: tournaments, page: { size: 10, number: 0, totalElements: tournaments.length, totalPages: 1 }
  }) }));
});

test('Landing cho khách: hero, số liệu thật, hành trình, AI và cộng đồng', async ({ page }, testInfo) => {
  await page.goto('/home');

  const hero = page.locator('.landing-hero');
  await expect(hero.locator('h1')).toContainText('Tìm sân.');
  await expect(hero.locator('h1')).toContainText('Vào trận.');
  await expect(hero.getByRole('link', { name: 'Tạo tài khoản miễn phí' })).toHaveAttribute('href', /\/register\?redirect=/);
  await expect(hero.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', /\/login\?redirect=/);
  await expect(page.locator('app-home-personal')).toHaveCount(0);

  // Số liệu lấy từ API công khai (đếm lên khi cuộn tới, cuối cùng phải đúng số thật).
  const stats = page.locator('.stats');
  await stats.scrollIntoViewIfNeeded();
  await expect(stats).toContainText('42');
  await expect(stats).toContainText('sân đang nhận đặt');
  await expect(stats).toContainText('câu lạc bộ đang hoạt động');
  await expect(stats).toContainText('6');

  await expect(page.locator('.step')).toHaveCount(4);
  await expect(page.locator('.criterion')).toHaveCount(7);
  await expect(page.locator('.criterion').first()).toContainText('30%');

  const outro = page.locator('app-home-landing-outro');
  await expect(outro.locator('.tour-card')).toHaveCount(2);
  await expect(outro.locator('.tour-card').first()).toContainText('Hết hạn ngày mai');
  await expect(outro.locator('.tour-card').first()).toContainText('200.000');
  await expect(outro.locator('.tour-card').nth(1)).toContainText('Chưa chốt ngày khởi tranh');
  await expect(outro.locator('.club-card')).toHaveCount(3);
  await expect(outro.locator('.club-card').first()).toContainText('GOAT Badminton');
  await expect(page.locator('.final-cta h2')).toContainText('Sẵn sàng');

  // Cấu hình e2e bật reduced-motion: landing tắt chuyển động nhưng mọi nội dung phía trên vẫn hiển thị đủ.
  // Không có hiệu ứng ghim thì dải 4 bước phải tự cuộn ngang được (không bị kẹt ở bước 01).
  const journeyTrack = page.locator('.journey__track');
  await expect(journeyTrack).toHaveCSS('overflow-x', 'auto');
  if (testInfo.project.name.startsWith('desktop')) {
    expect(await journeyTrack.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    await journeyTrack.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    await expect(page.locator('.step').nth(3)).toBeInViewport();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('landing-hero.png') });
  await page.screenshot({ path: testInfo.outputPath('landing-full.png'), fullPage: true });
});

test('Landing cho khách không có lỗi WCAG A/AA tự động', async ({ page }) => {
  await page.goto('/home');
  await expect(page.locator('.landing-hero h1')).toBeVisible();
  await expect(page.locator('.tour-card').first()).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = results.violations.map(({ id, help, nodes }) => ({ id, help, targets: nodes.flatMap(node => node.target) }));
  expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
});

test.describe('khi bật chuyển động', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('section hành trình được ghim dưới header và trượt ngang theo cuộn dọc', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('desktop'), 'Chỉ ghim trên màn ≥ 1024px');
    await page.goto('/home');
    await expect(page.locator('.landing-hero h1')).toBeVisible();
    const track = page.locator('.journey__track');
    const top = await page.locator('.journey').evaluate(element => element.getBoundingClientRect().top + window.scrollY);
    await page.evaluate(y => window.scrollTo(0, y), top - 64 + 900);
    await expect.poll(async () => track.evaluate(element => new DOMMatrix(getComputedStyle(element).transform).m41)).toBeLessThan(-600);
    // Section đứng yên ngay dưới header 64px trong lúc trượt.
    expect(Math.round(await page.locator('.journey').evaluate(element => element.getBoundingClientRect().top))).toBe(64);
    await page.screenshot({ path: testInfo.outputPath('landing-journey.png') });
  });
});
