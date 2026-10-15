import { expect, test } from '@playwright/test';
import { mockGoatSportsApi } from './fixtures/api.fixture';

// Tro ly GOAT AI: the du lieu that (giai, don...) bam vao mo dung trang, chi hien nguon cau tra loi trich,
// va hai cau hoi lien tiep gui cung ma cuoc tro chuyen (de tro ly hieu cau hoi noi tiep).

test('trợ lý hiện thẻ dữ liệu, chỉ nguồn được trích và giữ một mã cuộc trò chuyện', async ({ page }) => {
  await mockGoatSportsApi(page);
  const bodies: Array<{ message: string; conversationId: string }> = [];
  await page.route(url => url.pathname.endsWith('/ai-service/api/v1/ai/chatbot/query'), route => {
    bodies.push(route.request().postDataJSON());
    const first = bodies.length === 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        answer: first ? 'Có 1 giải pickleball đang mở đăng ký.' : 'Lệ phí đóng trong 24 giờ [Nguồn 2].',
        suggestedActions: [],
        cards: first ? [{
          kind: 'TOURNAMENT', title: 'Goat Pickleball Open 2026', subtitle: 'Pickleball · Đánh đôi',
          details: ['Thi đấu 01/11–02/11', '200.000đ · 10/16 suất'], link: '/tournaments/t-1'
        }] : [],
        sources: first ? [] : [
          { title: 'Tài khoản và hỗ trợ', heading: 'Liên hệ hỗ trợ' },
          { title: 'Giải đấu', heading: 'Lệ phí và thời hạn' }
        ],
        grounded: true
      })
    });
  });
  await page.goto('/policy/booking-policy');

  await page.getByRole('button', { name: 'Mở trợ lý GOAT AI' }).click();
  const input = page.getByPlaceholder('Hỏi GOAT AI bất kỳ điều gì...');
  await input.fill('Có giải pickleball nào đang mở không?');
  await page.getByRole('button', { name: 'Gửi tin nhắn' }).click();

  const card = page.getByRole('button', { name: /Goat Pickleball Open 2026/ });
  await expect(card).toBeVisible();
  await expect(card).toContainText('200.000đ · 10/16 suất');

  await input.fill('Lệ phí phải đóng trong bao lâu?');
  await page.getByRole('button', { name: 'Gửi tin nhắn' }).click();
  const sources = page.getByRole('list', { name: 'Nguồn trích dẫn' });
  await expect(sources).toHaveText(/\[2\] Giải đấu › Lệ phí và thời hạn/);
  await expect(sources).not.toContainText('Liên hệ hỗ trợ');

  expect(bodies).toHaveLength(2);
  expect(bodies[0].conversationId).toMatch(/^[0-9a-f-]{36}$/);
  expect(bodies[1].conversationId).toBe(bodies[0].conversationId);

  await card.click();
  await expect(page).toHaveURL(/\/tournaments\/t-1$/);
});

test('"Chưa hữu ích" gửi câu hỏi và câu trả lời để quản trị viên bổ sung kiến thức', async ({ page }) => {
  await mockGoatSportsApi(page);
  await page.route(url => url.pathname.endsWith('/ai-service/api/v1/ai/chatbot/query'), route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ answer: 'Mình chưa có thông tin về việc này.', suggestedActions: [], cards: [], sources: [], grounded: false })
  }));
  const reports: Array<{ question: string; answer: string; conversationId: string }> = [];
  await page.route(url => url.pathname.endsWith('/ai-service/api/v1/ai/chatbot/feedback'), route => {
    reports.push(route.request().postDataJSON());
    return route.fulfill({ status: 202, contentType: 'application/json', body: '{"accepted":true}' });
  });
  await page.goto('/policy/booking-policy');

  await page.getByRole('button', { name: 'Mở trợ lý GOAT AI' }).click();
  // Lời chào không có nút báo: chỉ câu trả lời cho một câu hỏi mới báo được.
  await expect(page.getByRole('button', { name: 'Báo câu trả lời này chưa hữu ích' })).toHaveCount(0);
  await page.getByPlaceholder('Hỏi GOAT AI bất kỳ điều gì...').fill('Sân nào rẻ nhất?');
  await page.getByRole('button', { name: 'Gửi tin nhắn' }).click();

  await page.getByRole('button', { name: 'Báo câu trả lời này chưa hữu ích' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Cảm ơn bạn' })).toBeVisible();
  expect(reports).toHaveLength(1);
  expect(reports[0].question).toBe('Sân nào rẻ nhất?');
  expect(reports[0].answer).toBe('Mình chưa có thông tin về việc này.');
  expect(reports[0].conversationId).toMatch(/^[0-9a-f-]{36}$/);
});
