// Chụp ảnh tạm trang admin với API giả lập (xóa sau khi dùng).
import { chromium } from '@playwright/test';

const S = 'C:/Users/HP/AppData/Local/Temp/claude/e--GoatSports/84b1153a-bd91-466f-a41e-8abd2d150923/scratchpad/';
const ok = data => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ statusCode: 200, data }) });

const admin = { userId: 'a1', username: 'admin', fullName: 'Quản trị viên', email: 'admin@goat.test', status: 'ACTIVE', role: { name: 'ADMIN' } };
const owner = { userId: 'o1', username: 'owner', fullName: 'Lê Minh Khoa', email: 'owner@goat.test', status: 'ACTIVE', role: { name: 'VENUE_OWNER' } };
const venue = (id, name, extra = {}) => ({
  venueId: id, name, active: true, district: 'Thủ Đức', city: 'Hồ Chí Minh', phone: '0909 318 472', email: `${id}@goat.test`,
  averageRating: 4.3, totalReviews: 27, imageUrls: [], amenities: [], courts: [{}, {}, {}, {}], openTime: '06:00:00', closeTime: '22:00:00',
  address: '12 Võ Văn Ngân', minPrice: 120000, maxPrice: 300000, ...extra
});
const venues = [
  venue('v1', 'Nhà thi đấu Phú Thọ', { district: 'Quận 11' }),
  venue('v2', 'Sân Chảo Lửa', { active: false, suspendedAt: '2026-09-27T09:12:00', suspensionReason: 'Nhiều khiếu nại về mặt sân trơn trượt, chủ sân chưa khắc phục sau 2 lần nhắc' }),
  venue('v3', 'Goat Arena Thủ Đức', { active: false, totalReviews: 0 }),
  venue('v4', 'Pickleball Sài Gòn Xanh', { district: 'Quận 7', averageRating: 4.8, totalReviews: 112 })
];
const review = (id, rating, status, content) => ({
  reviewId: id, venueId: 'v1', venueName: 'Nhà thi đấu Phú Thọ', venueCourtId: 'c1', courtName: 'Sân cầu lông 3',
  bookingId: 'b' + id, bookingCode: 'GS' + (482910 + Number(id.slice(1))), playDate: '2026-09-20', startTime: '18:00:00', endTime: '19:00:00',
  rating, content, status, createdAt: '2026-09-21T08:14:00'
});
const reviews = [
  review('r1', 1, 'PUBLISHED', 'Chủ sân thái độ, gọi điện đòi thêm tiền đèn dù đã trả đủ trên app. Sân trơn, suýt té 2 lần.'),
  review('r2', 5, 'PUBLISHED', 'Sân sạch, đèn sáng, nhân viên check-in nhanh. Sẽ quay lại.'),
  review('r3', 2, 'HIDDEN', 'Liên hệ zalo 0909xxx để được giá rẻ hơn app!!!'),
  review('r4', 4, 'REMOVED', null)
];

async function mock(page, user) {
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('/auth/me')) return route.fulfill(ok(user));
    if (url.includes('/admin/venues')) return route.fulfill(ok({ items: venues, total: venues.length, page: 0, pageSize: 20, totalPages: 1 }));
    if (url.includes('/admin/reviews')) return route.fulfill(ok({ meta: { page: 0, pageSize: 20, pages: 1, total: 4 }, result: reviews }));
    if (url.match(/\/owner\/venues\/[^/?]+$/)) return route.fulfill(ok(venues[1]));
    if (url.match(/\/owner\/venues(\?|$)/)) return route.fulfill(ok([venues[1]]));
    if (url.includes('owner-applications')) return route.fulfill(ok({ meta: { page: 1, pageSize: 1000, pages: 1, total: 0 }, result: [] }));
    if (url.includes('/notifications')) return route.fulfill(ok(url.includes('unread') ? 0 : { meta: { page: 1, pageSize: 10, pages: 0, total: 0 }, result: [] }));
    if (url.includes(':7070') || url.includes('/ws')) return route.fulfill(ok(null));
    return route.continue();
  });
}

const browser = await chromium.launch();
for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport });
  await mock(page, admin);
  await page.goto('http://127.0.0.1:4310/admin/platform-venues');
  await page.getByRole('heading', { name: 'Cơ sở thể thao' }).waitFor({ timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${S}venues-${name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Đình chỉ' }).first().click();
  await page.locator('textarea').fill('Mặt sân xuống cấp');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${S}venues-suspend-${name}.png` });
  await page.goto('http://127.0.0.1:4310/admin/platform-reviews?venueId=v1&venueName=Nh%C3%A0%20thi%20%C4%91%E1%BA%A5u%20Ph%C3%BA%20Th%E1%BB%8D');
  await page.getByRole('heading', { name: 'Đánh giá cơ sở' }).waitFor({ timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${S}reviews-${name}.png`, fullPage: true });
  await page.close();
}
const ownerPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await mock(ownerPage, owner);
await ownerPage.goto('http://127.0.0.1:4310/admin/venues');
await ownerPage.locator('.suspension-banner').waitFor({ timeout: 60000 }).catch(() => {});
await ownerPage.waitForTimeout(800);
await ownerPage.screenshot({ path: `${S}owner-suspended.png` });
await browser.close();
console.log('done');
