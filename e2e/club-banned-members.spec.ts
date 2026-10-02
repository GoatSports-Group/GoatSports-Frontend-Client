import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

// Tab "Yeu cau tham gia" cua chi tiet CLB: chip "Bi cam" liet ke nguoi bi chu CLB / quan ly cam va cho go cam.
const ok = (data: unknown) => ({ json: { statusCode: 200, message: 'OK', data } });
const me = '11111111-1111-4111-8111-111111111111';
const clubId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const bannedUser = { userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', fullName: 'Lê Văn Tài' };
const club = {
  clubId, ownerId: me, name: 'Weekend Club', sportType: 'FOOTBALL', privacy: 'PUBLIC', approvalMode: 'MANUAL',
  active: true, winCount: 0, lossCount: 0, drawCount: 0, matchCount: 0, winRate: 0, memberCount: 4, tags: []
};
const page0 = (content: unknown[]) => ({ content, page: { size: 10, number: 0, totalElements: content.length, totalPages: content.length ? 1 : 0 } });

test('chủ CLB xem người bị cấm và gỡ cấm ngay trên dòng', async ({ page }) => {
  let banned = [{
    membershipId: 'm-banned', clubId, userId: bannedUser.userId, role: 'MEMBER', status: 'BANNED',
    respondedBy: me, respondedAt: '2026-09-20T09:00:00'
  }];
  const unbans: string[] = [];
  await mockGoatSportsApi(page);
  await page.route(`**/club-service/api/v1/clubs/${clubId}`, route => route.fulfill(ok(club)));
  await page.route(`**/club-service/api/v1/clubs/${clubId}/membership/me`, route =>
    route.fulfill(ok({ membershipId: 'm-me', clubId, userId: me, role: 'OWNER', status: 'ACTIVE' })));
  await page.route(`**/club-service/api/v1/clubs/${clubId}/members/page**`, route => {
    const status = new URL(route.request().url()).searchParams.get('status');
    return route.fulfill(ok(page0(status === 'BANNED' ? banned : [])));
  });
  await page.route(`**/club-service/api/v1/clubs/${clubId}/members/*/unban`, route => {
    unbans.push(route.request().url().split('/').at(-2)!);
    banned = [];
    return route.fulfill({ status: 204, body: '' });
  });
  await page.route(`**/auth-service/api/v1/users/${bannedUser.userId}`, route =>
    route.fulfill(ok({ ...bannedUser, username: 'le_van_tai', email: 'tai@goatsports.test', avatarUrl: '', status: 'ACTIVE' })));

  await page.goto(`/clubs/${clubId}`);
  await page.getByRole('tab', { name: 'Yêu cầu tham gia' }).click();
  const bannedChip = page.getByRole('button', { name: /Bị cấm/ });
  await expect(bannedChip).toContainText('1');
  await bannedChip.click();

  const row = page.locator('.request-card--banned');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Lê Văn Tài');
  await expect(row).toContainText('Bị cấm từ 20/09/2026 · bởi bạn');

  // Mot hanh dong -> xac nhan ngay tren dong.
  await row.getByRole('button', { name: 'Gỡ cấm' }).click();
  await expect(row.getByText('Gỡ cấm Lê Văn Tài?')).toBeVisible();
  await row.locator('.unban-confirm').getByRole('button', { name: 'Gỡ cấm' }).click();

  expect(unbans).toEqual(['m-banned']);
  await expect(page.getByText('Không có ai bị cấm')).toBeVisible();
  await expect(bannedChip).toContainText('0');
});
