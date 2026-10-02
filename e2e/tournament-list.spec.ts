import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

// Trang Giai dau: nhip mua giai, vung navy (mo dang ky hoac dang dien ra), chip mon, the co dai mat san theo mon.
const ok = (data: unknown) => ({ data, statusCode: 200, message: null, error: null });

function day(offset: number): string {
  const value = new Date(Date.now() + offset * 86_400_000);
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
}

function tournament(index: number, status: string, sportType: string, extra: Record<string, unknown> = {}) {
  return {
    tournamentId: `t0000000-0000-4000-8000-0000000000${String(index).padStart(2, '0')}`, organizerId: 'o1',
    name: `Giải ${index + 1}`, sportType, format: 'SINGLE_ELIMINATION', status, maxParticipants: 8, currentParticipants: 5,
    entryFee: 200000, prizePool: 0, registrationOpenDate: day(-10), registrationCloseDate: day(2),
    startDate: day(5), endDate: day(7), rules: [], playFormatLabel: 'Đôi', participantType: 'TEAM', ...extra
  };
}

const all = [
  tournament(0, 'REGISTRATION_OPEN', 'BADMINTON', { name: 'Giải Cầu Lông Mở Rộng', registrationCloseDate: day(1) }),
  tournament(1, 'IN_PROGRESS', 'FOOTBALL', { name: 'Cúp Sân 7 Mùa Thu', startDate: day(-2), endDate: day(5), currentParticipants: 8 }),
  tournament(2, 'REGISTRATION_CLOSED', 'BASKETBALL', { name: 'Giải Bóng Rổ 5x5' }),
  tournament(3, 'COMPLETED', 'TENNIS', { name: 'Giải Tennis Mùa Hè', startDate: day(-20), endDate: day(-18) })
];

async function mockTournaments(page: Page, items = all) {
  const requests: URL[] = [];
  await page.route('**/club-service/api/v1/tournaments/search**', route => {
    const url = new URL(route.request().url());
    requests.push(url);
    const status = url.searchParams.get('status');
    const sport = url.searchParams.get('sportType');
    const size = Number(url.searchParams.get('size') ?? 12);
    const matched = items.filter(item => (!status || item.status === status) && (!sport || item.sportType === sport));
    return route.fulfill({ json: ok({ content: matched.slice(0, size), page: { size, number: 0, totalElements: matched.length, totalPages: 1 } }) });
  });
  return requests;
}

test('nhịp mùa giải, vùng nổi bật và thẻ theo môn', async ({ page }) => {
  await mockGoatSportsApi(page);
  await mockTournaments(page);
  await page.goto('/tournaments');

  const pulse = page.locator('.pulse');
  await expect(pulse.getByRole('button', { name: /Đang diễn ra/ })).toContainText('1');
  await expect(pulse.getByRole('button', { name: /Mở đăng ký/ })).toContainText('1');
  await expect(pulse.getByRole('button', { name: /Sắp khởi tranh/ })).toContainText('1');

  // Co giai dang mo: vung navy dem nguoc ngay dong dang ky.
  await expect(page.locator('.featured')).toContainText('Giải Cầu Lông Mở Rộng');
  await expect(page.locator('.featured')).toContainText('ngày còn lại để đăng ký');

  const cards = page.locator('.t-card');
  await expect(cards).toHaveCount(4);
  // Pagination luon hien, ke ca khi chi co mot trang.
  await expect(page.locator('app-pagination')).toContainText('Hiển thị 1 - 4 trong tổng số 4 giải đấu');
  await expect(cards.filter({ hasText: 'Giải Cầu Lông Mở Rộng' })).toHaveClass(/t-card--court/);
  await expect(cards.filter({ hasText: 'Giải Cầu Lông Mở Rộng' }).locator('.t-card__urgent')).toContainText('Còn 1 ngày');
  await expect(cards.filter({ hasText: 'Cúp Sân 7 Mùa Thu' })).toHaveClass(/t-card--grass/);
  await expect(cards.filter({ hasText: 'Cúp Sân 7 Mùa Thu' }).locator('.t-card__status .live-dot')).toHaveCount(1);
  await expect(cards.filter({ hasText: 'Giải Bóng Rổ 5x5' })).toHaveClass(/t-card--hardwood/);
  await expect(cards.filter({ hasText: 'Giải Tennis Mùa Hè' })).toHaveClass(/t-card--completed/);

  // Bam o "Dang dien ra" de loc, bam lan nua de bo loc.
  await pulse.getByRole('button', { name: /Đang diễn ra/ }).click();
  await expect(cards).toHaveCount(1);
  await pulse.getByRole('button', { name: /Đang diễn ra/ }).click();
  await expect(cards).toHaveCount(4);

  // Chip mon.
  await page.locator('.sport-chips').getByRole('button', { name: 'Bóng đá' }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Cúp Sân 7 Mùa Thu');
});

test('không còn giải mở: vùng navy chuyển sang giải đang diễn ra', async ({ page }) => {
  await mockGoatSportsApi(page);
  await mockTournaments(page, all.filter(item => item.status !== 'REGISTRATION_OPEN'));
  await page.goto('/tournaments');

  const featured = page.locator('.featured');
  await expect(featured).toHaveClass(/featured--live/);
  await expect(featured).toContainText('Cúp Sân 7 Mùa Thu');
  await expect(featured).toContainText('Ngày 3');
  await expect(featured).toContainText('Xem lịch thi đấu');
});

test('trang Giải đấu đạt WCAG A/AA (chip trên mặt sân, chấm LIVE, nhịp mùa giải)', async ({ page }) => {
  await mockGoatSportsApi(page);
  await mockTournaments(page);
  await page.goto('/tournaments');
  await expect(page.locator('.t-card')).toHaveCount(4);
  const results = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map(item => `${item.id}: ${item.nodes.map(node => node.target.join(' ')).join(', ')}`)).toEqual([]);
});
