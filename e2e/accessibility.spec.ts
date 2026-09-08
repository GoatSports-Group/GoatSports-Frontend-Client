import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

const pages = [
  { path: '/home', heading: 'Tìm Sân Thể Thao' },
  { path: '/venues', heading: 'Khám Phá Sân Thể Thao' },
  { path: '/feed', heading: 'Bảng tin thể thao' },
  { path: '/policy/booking-policy', heading: 'Chính sách đặt sân' }
];

test.beforeEach(async ({ page }) => {
  await mockGoatSportsApi(page);
});

for (const target of pages) {
  test(`${target.path} không có lỗi WCAG A/AA tự động`, async ({ page }) => {
    await page.goto(target.path);
    await expect(page.getByRole('heading', { name: target.heading, exact: false }).first()).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const summary = results.violations.map(({ help, id, impact, nodes }) => ({
      help,
      id,
      impact,
      targets: nodes.flatMap(node => node.target)
    }));

    expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
  });
}
