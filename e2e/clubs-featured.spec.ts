import { expect, test, type Page } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

// CLB noi bat do club-service xep hang (GET /clubs/featured). Client gui mon + ma tinh tu ho so the thao
// va ghep dong ly do tu so lieu tra ve.
const ok = (data: unknown) => ({ data, statusCode: 200, message: null, error: null });

function club(index: number) {
  return {
    clubId: `c0000000-0000-4000-8000-0000000000${String(index).padStart(2, '0')}`,
    name: `CLB Nổi Bật ${index + 1}`, sportType: 'FOOTBALL', city: 'ho-chi-minh', location: 'Thủ Đức',
    description: 'Đá giao lưu tối thứ Tư.', tags: [], memberCount: 12, winRate: 0.64, matchCount: 14,
    privacy: 'PUBLIC', approvalMode: 'AUTO', active: true
  };
}

async function mockFeatured(page: Page, total: number) {
  const requests: URL[] = [];
  await page.route('**/auth-service/api/v1/users/me/sport-profiles', route => route.fulfill({ json: ok([
    { profileId: 'p1', sportType: 'FOOTBALL', city: 'Hồ Chí Minh', eloRating: 1200 }
  ]) }));
  await page.route('**/club-service/api/v1/clubs/featured**', route => {
    const url = new URL(route.request().url());
    requests.push(url);
    const pageIndex = Number(url.searchParams.get('page'));
    const size = Number(url.searchParams.get('size'));
    const count = Math.max(0, Math.min(size, total - pageIndex * size));
    const content = Array.from({ length: count }, (_, i) => ({
      club: club(pageIndex * size + i), score: 70 - i, sameSport: true, sameCity: true, recentActivities: 3, newMembers: 0
    }));
    return route.fulfill({ json: ok({ content, page: { size, number: pageIndex, totalElements: total, totalPages: Math.ceil(total / size) } }) });
  });
  return requests;
}

test('trang Câu lạc bộ: CLB nổi bật lấy từ club-service, có dòng lý do, gửi môn và tỉnh của người chơi', async ({ page }) => {
  await mockGoatSportsApi(page);
  const requests = await mockFeatured(page, 3);

  await page.goto('/clubs');
  const featured = page.locator('.featured-club');
  await expect(featured).toContainText('CLB Nổi Bật 1');
  await expect(featured.locator('.featured-club__reason'))
    .toHaveText('Cùng môn bóng đá · Cùng khu vực với bạn · 3 buổi sinh hoạt gần đây');
  await expect(page.locator('#featured-club-title + p')).toContainText('Gợi ý theo môn bạn chơi');

  const last = requests.at(-1)!;
  expect(last.searchParams.getAll('sport')).toEqual(['FOOTBALL']);
  expect(last.searchParams.getAll('city')).toEqual(['ho-chi-minh']);
  expect(last.searchParams.get('size')).toBe('1');
});

test('trang Câu lạc bộ: không có CLB đủ tiêu chí thì nói rõ điều kiện', async ({ page }) => {
  await mockGoatSportsApi(page);
  await mockFeatured(page, 0);

  await page.goto('/clubs');
  await expect(page.getByText('Chưa có câu lạc bộ nổi bật')).toBeVisible();
  await expect(page.getByText(/ít nhất 3 thành viên/)).toBeVisible();
});

test('/clubs/featured: phân trang ở server và giữ thứ tự xếp hạng', async ({ page }) => {
  await mockGoatSportsApi(page);
  const requests = await mockFeatured(page, 14);

  await page.goto('/clubs/featured');
  // PAGE_SIZE.grid = 12: 4 / 3 / 2 cot deu kin hang.
  await expect(page.locator('.featured-card')).toHaveCount(12);
  await expect(page.locator('.featured-card').first()).toContainText('#1');
  await expect(page.locator('.featured-card').first().locator('.reason')).toContainText('Cùng môn bóng đá');
  await expect(page.locator('.hero-count')).toContainText('14');

  await page.locator('app-pagination').getByRole('button', { name: 'Trang 2' }).click();
  await expect(page.locator('.featured-card')).toHaveCount(2);
  await expect(page.locator('.featured-card').first()).toContainText('#13');
  expect(requests.at(-1)!.searchParams.get('page')).toBe('1');
});

test('trang Câu lạc bộ: đổi bộ lọc không chèn khung xương lên trên "CLB của bạn"', async ({ page }) => {
  await mockGoatSportsApi(page);
  await mockFeatured(page, 1);
  let calls = 0;
  await page.route('**/club-service/api/v1/clubs/me', async route => {
    calls += 1;
    // Lan tai lai (sau khi doi bo loc) tra cham de bat duoc trang thai dang tai.
    if (calls > 1) await new Promise(resolve => setTimeout(resolve, 1500));
    await route.fulfill({ json: ok([{ membershipId: 'm1', role: 'OWNER', status: 'ACTIVE', club: { ...club(40), name: 'Weekend Club' } }]) });
  });

  const emptyPage = ok({ content: [], page: { size: 20, number: 0, totalElements: 0, totalPages: 0 } });
  await page.route('**/club-service/api/v1/clubs/me/requests', route => route.fulfill({ json: ok([]) }));
  await page.route('**/club-service/api/v1/clubs/me/invitations', route => route.fulfill({ json: ok([]) }));
  await page.route('**/club-service/api/v1/clubs/me/activities/page**', route => route.fulfill({ json: emptyPage }));
  await page.route('**/club-service/api/v1/clubs/search**', route => route.fulfill({ json: emptyPage }));

  await page.goto('/clubs');
  const rail = page.locator('.rail-section').filter({ has: page.getByRole('heading', { name: 'CLB của bạn' }) });
  await expect(rail.getByText('Weekend Club')).toBeVisible();

  await page.getByRole('button', { name: 'Lọc theo môn thể thao' }).click();
  await page.getByRole('option', { name: 'Bóng đá' }).click();
  // Dang tai lai: van thay danh sach cu, khong co skeleton.
  await expect(rail.locator('app-loading-skeleton')).toHaveCount(0);
  await expect(rail.getByText('Weekend Club')).toBeVisible();
  await expect.poll(() => calls).toBeGreaterThan(1);
  await expect(rail.locator('.compact-club')).toHaveCount(1);
});
