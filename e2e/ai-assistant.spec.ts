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
    body: JSON.stringify({ answer: 'Mình chưa có thông tin về việc này.', suggestedActions: [], cards: [], sources: [], grounded: false,
      question: 'Sân nào rẻ nhất ở Khánh Hòa?' })
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
  // Gửi câu hỏi đầy đủ server đã viết lại, không phải câu người dùng gõ (có thể là câu nối tiếp cụt).
  expect(reports[0].question).toBe('Sân nào rẻ nhất ở Khánh Hòa?');
  expect(reports[0].answer).toBe('Mình chưa có thông tin về việc này.');
  expect(reports[0].conversationId).toMatch(/^[0-9a-f-]{36}$/);
});

test('gợi ý "Lập lịch tập cho mình" trả lịch nhiều tuần và từng buổi, bấm buổi tập mở tìm sân đúng môn', async ({ page }) => {
  await mockGoatSportsApi(page);
  const bodies: Array<{ message: string }> = [];
  await page.route(url => url.pathname.endsWith('/ai-service/api/v1/ai/chatbot/query'), route => {
    bodies.push(route.request().postDataJSON());
    const link = '/venues?sportType=BADMINTON&city=H%E1%BB%93+Ch%C3%AD+Minh';
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        answer: 'Mình lập lịch cầu lông 3 buổi/tuần cho bạn.', suggestedActions: [], sources: [], grounded: true,
        cards: [
          { kind: 'PLAN', title: 'Lịch tập cầu lông · 3 buổi/tuần', subtitle: 'Nâng kỹ thuật · trình độ trung bình · 4 tuần',
            details: ['Tuần 1: 3 buổi · 100% khối lượng', 'Tuần 4: 3 buổi · 80% khối lượng'], link },
          { kind: 'SESSION', title: 'Thứ Ba 18:00–19:15 · Kỹ thuật', subtitle: 'Cường độ vừa · 75 phút',
            details: ['Khởi động 15′: Nhảy dây nhẹ', 'Phần chính 50′: Đánh cầu cao sâu (clear) cuối sân 3 × 20 quả',
              'Thả lỏng 10′: Giãn cơ tĩnh'], link }
        ]
      })
    });
  });
  await page.goto('/policy/booking-policy');
  await page.getByRole('button', { name: 'Mở trợ lý GOAT AI' }).click();
  await page.getByRole('button', { name: 'Lập lịch tập cho mình' }).click();

  await expect(page.getByRole('button', { name: /Lịch tập cầu lông · 3 buổi\/tuần/ })).toContainText('Tuần 4: 3 buổi · 80% khối lượng');
  const session = page.getByRole('button', { name: /Thứ Ba 18:00–19:15 · Kỹ thuật/ });
  await expect(session).toContainText('Phần chính 50′: Đánh cầu cao sâu (clear)');
  expect(bodies[0].message).toBe('Lập lịch tập cho mình');

  await session.click();
  await expect(page).toHaveURL(/\/venues\?sportType=BADMINTON&city=H/);
});

test('thẻ Wikipedia mở tab mới và giữ nguyên cuộc trò chuyện', async ({ page, context }) => {
  await mockGoatSportsApi(page);
  await page.route(url => url.pathname.endsWith('/ai-service/api/v1/ai/chatbot/query'), route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ answer: 'Theo Wikipedia, việt vị là luật XI.', suggestedActions: [], sources: [], grounded: true,
      cards: [{ kind: 'WEB', title: 'Luật việt vị (bóng đá)', subtitle: 'Wikipedia tiếng Việt', details: ['Luật việt vị là luật XI…'],
        link: 'https://vi.wikipedia.org/wiki/Lu%E1%BA%ADt_vi%E1%BB%87t_v%E1%BB%8B' }] })
  }));
  await context.route('https://vi.wikipedia.org/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Wiki</h1>' }));
  await page.goto('/policy/booking-policy');
  await page.getByRole('button', { name: 'Mở trợ lý GOAT AI' }).click();
  await page.getByPlaceholder('Hỏi GOAT AI bất kỳ điều gì...').fill('Luật việt vị là gì?');
  await page.getByRole('button', { name: 'Gửi tin nhắn' }).click();

  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('button', { name: /Luật việt vị \(bóng đá\)/ }).click()
  ]);
  expect(popup.url()).toContain('vi.wikipedia.org');
  await expect(page).toHaveURL(/\/policy\/booking-policy$/);
  await expect(page.getByRole('log', { name: 'Cuộc trò chuyện với GOAT AI' })).toContainText('Theo Wikipedia');
});
