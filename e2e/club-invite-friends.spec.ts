import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

const ok = (data: unknown) => ({ json: { statusCode: 200, message: 'OK', data } });
const me = '11111111-1111-4111-8111-111111111111';
const clubId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const newcomer = { userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', username: 'le_van_tai', fullName: 'Lê Văn Tài' };
const teammate = { userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', username: 'pham_thu', fullName: 'Phạm Thu' };

const club = {
  clubId, ownerId: me, name: 'Weekend Club', sportType: 'FOOTBALL', privacy: 'PUBLIC', approvalMode: 'MANUAL',
  active: true, winCount: 0, lossCount: 0, drawCount: 0, matchCount: 0, winRate: 0, memberCount: 5, tags: []
};

test.describe('Tuyển thành viên · Mời bạn bè', () => {
  const invites: Array<{ inviteeId: string; message?: string }> = [];

  test.beforeEach(async ({ page }) => {
    invites.length = 0;
    await mockGoatSportsApi(page);
    await page.route('**/club-service/api/v1/clubs/me', route =>
      route.fulfill(ok([{ membershipId: 'm-1', role: 'OWNER', status: 'ACTIVE', club }])));
    await page.route(`**/club-service/api/v1/clubs/${clubId}`, route => route.fulfill(ok(club)));
    await page.route(`**/club-service/api/v1/clubs/${clubId}/scouting**`, route => route.fulfill(ok([])));
    await page.route(`**/club-service/api/v1/clubs/${clubId}/scouting/relations`, route => {
      const { userIds } = route.request().postDataJSON() as { userIds: string[] };
      return route.fulfill(ok(Object.fromEntries(userIds.map(id => [id, id === teammate.userId ? 'MEMBER' : 'NONE']))));
    });
    await page.route(`**/club-service/api/v1/clubs/${clubId}/invitations`, route => {
      if (route.request().method() === 'POST') {
        invites.push(route.request().postDataJSON());
        return route.fulfill(ok({ invitationId: 'inv-1', clubId, inviteeId: newcomer.userId, status: 'PENDING' }));
      }
      return route.fulfill(ok([]));
    });
    // Có query string (?userId=...), nên khớp bằng regex thay vì glob.
    await page.route(/\/social-service\/api\/v1\/social\/friends(\?.*)?$/, route => route.fulfill(ok([
      { friendshipId: 'f-1', requesterId: me, addresseeId: newcomer.userId, status: 'ACCEPTED', requestedAt: '2026-09-01T08:00:00' },
      { friendshipId: 'f-2', requesterId: teammate.userId, addresseeId: me, status: 'ACCEPTED', requestedAt: '2026-09-02T08:00:00' },
      { friendshipId: 'f-3', requesterId: me, addresseeId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', status: 'PENDING', requestedAt: '2026-09-03T08:00:00' }
    ])));
    for (const user of [newcomer, teammate]) {
      await page.route(`**/auth-service/api/v1/users/${user.userId}`, route => route.fulfill(ok({
        ...user, email: `${user.username}@goatsports.test`, avatarUrl: '', status: 'ACTIVE'
      })));
    }
  });

  test('liệt kê bạn bè kèm trạng thái với CLB và mời thẳng, không qua lọc khoảng cách hay trình độ', async ({ page }) => {
    await page.goto(`/clubs/my/${clubId}/players`);
    await page.getByRole('tab', { name: 'Mời bạn bè' }).click();

    const rows = page.locator('.row--friend');
    // Chỉ bạn bè đã kết bạn (ACCEPTED); người mời được đứng trước.
    await expect(rows).toHaveCount(2);
    await expect(page.getByText('1 người mời được')).toBeVisible();
    await expect(rows.nth(0)).toContainText('Lê Văn Tài');
    await expect(rows.nth(1)).toContainText('Phạm Thu');
    await expect(rows.nth(1)).toContainText('Đã là thành viên');
    await expect(rows.nth(1).getByRole('button', { name: /Mời/ })).toHaveCount(0);

    await rows.nth(0).getByRole('button', { name: 'Mời Lê Văn Tài' }).click();
    const dialog = page.getByRole('dialog', { name: 'Mời Lê Văn Tài' });
    await dialog.getByRole('textbox').fill('Vào đá cùng tụi mình tối thứ Năm nhé');
    await dialog.getByRole('button', { name: 'Gửi lời mời' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(rows.nth(0)).toContainText('Đã mời');
    expect(invites).toEqual([{ inviteeId: newcomer.userId, message: 'Vào đá cùng tụi mình tối thứ Năm nhé' }]);
  });

  test('lọc bạn theo tên', async ({ page }) => {
    await page.goto(`/clubs/my/${clubId}/players`);
    await page.getByRole('tab', { name: 'Mời bạn bè' }).click();
    await page.getByRole('searchbox', { name: 'Tìm bạn theo tên hoặc tài khoản' }).fill('thu');

    await expect(page.locator('.row--friend')).toHaveCount(1);
    await expect(page.locator('.row--friend')).toContainText('Phạm Thu');
  });
});
