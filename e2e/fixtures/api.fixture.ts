import { Page, Route } from '@playwright/test';

const currentUser = {
  userId: '11111111-1111-4111-8111-111111111111',
  email: 'player@goatsports.test',
  username: 'goat_player',
  fullName: 'Nguyễn Minh Anh',
  avatarUrl: '',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00',
  updatedAt: '2026-01-01T00:00:00',
  role: { roleId: '22222222-2222-4222-8222-222222222222', name: 'PLAYER' }
};

const postAuthor = {
  ...currentUser,
  userId: '33333333-3333-4333-8333-333333333333',
  email: 'friend@goatsports.test',
  username: 'badminton_friend',
  fullName: 'Trần Hoàng Nam'
};

const emptySpringPage = {
  content: [], totalElements: 0, totalPages: 0, number: 0, size: 10,
  first: true, last: true, empty: true, numberOfElements: 0
};

function baseResponse(data: unknown) {
  return { data, statusCode: 200, message: null, error: null };
}

const DIRECT_ROOM = '88888888-8888-4888-8888-888888888888';
const now = Date.now();
const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString().slice(0, 19);

const rooms = [
  {
    conversationId: DIRECT_ROOM, type: 'DIRECT', name: postAuthor.fullName, unreadCount: 2,
    lastMessageContent: 'Tối nay 19h sân Thủ Đức nhé?', lastMessageAt: minutesAgo(3), lastSenderId: postAuthor.userId,
    members: [
      { userId: currentUser.userId, userName: currentUser.fullName },
      { userId: postAuthor.userId, userName: postAuthor.fullName }
    ],
    createdAt: minutesAgo(3000), updatedAt: minutesAgo(3)
  },
  {
    conversationId: '99999999-9999-4999-8999-999999999999', type: 'CLUB', name: 'GOAT Badminton Club', unreadCount: 0,
    lastMessageContent: 'Lịch tập tuần này đã cập nhật', lastMessageAt: minutesAgo(90), lastSenderId: currentUser.userId,
    members: [{ userId: currentUser.userId, userName: currentUser.fullName }, { userId: postAuthor.userId, userName: postAuthor.fullName }],
    createdAt: minutesAgo(9000), updatedAt: minutesAgo(90)
  },
  {
    conversationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', type: 'GROUP', name: 'Kèo cuối tuần', unreadCount: 0,
    lastMessageContent: 'Chốt 6 người', lastMessageAt: minutesAgo(1500), lastSenderId: postAuthor.userId,
    members: [{ userId: currentUser.userId, userName: currentUser.fullName }, { userId: postAuthor.userId, userName: postAuthor.fullName }],
    createdAt: minutesAgo(9000), updatedAt: minutesAgo(1500)
  }
];

/** Ban sao danh sach doan chat (dang trang Spring), de test sua mot phong roi tra ve. */
export function chatRoomsPage(edit: (items: typeof rooms) => void = () => undefined) {
  const items = structuredClone(rooms);
  edit(items);
  return { ...emptySpringPage, content: items, totalElements: items.length, empty: false };
}

const messages = [
  { from: postAuthor, text: 'Chào bạn, cuối tuần rảnh đánh cầu không?', at: 50 },
  { from: currentUser, text: 'Rảnh nè! Mấy giờ vậy?', at: 45 },
  { from: postAuthor, text: 'Tối nay 19h sân Thủ Đức nhé?', at: 4 },
  { from: postAuthor, text: 'Mình đặt sân 2 rồi, bạn chỉ cần mang vợt.', at: 3 }
].map((item, index) => ({
  messageId: `m${index}`, conversationId: DIRECT_ROOM, senderId: item.from.userId, senderName: item.from.fullName,
  content: item.text, type: 'TEXT', status: 'READ', attachments: [], receipts: [], sentAt: minutesAgo(item.at)
}));

async function handleChat(route: Route, path: string): Promise<void> {
  if (path.endsWith('/conversations')) {
    await route.fulfill({ json: baseResponse({ ...emptySpringPage, content: rooms, totalElements: rooms.length, empty: false }) });
    return;
  }
  if (path.endsWith('/messages') && route.request().method() === 'GET') {
    await route.fulfill({ json: baseResponse({ ...emptySpringPage, content: [...messages].reverse(), totalElements: messages.length, empty: false }) });
    return;
  }
  if (path.endsWith('/messages')) {
    const body = route.request().postDataJSON() as {
      content: string; clientMessageId?: string; type?: string;
      attachments?: Array<{ storageKey: string; type: string; fileName?: string; fileSize?: number }>;
    };
    storageCalls.messages.push(body);
    await route.fulfill({ json: baseResponse({
      messageId: `m${Date.now()}`, conversationId: DIRECT_ROOM, senderId: currentUser.userId, senderName: currentUser.fullName,
      clientMessageId: body.clientMessageId, content: body.content, type: body.type ?? 'TEXT', status: 'SENT',
      attachments: (body.attachments ?? []).map((item, index) => ({
        attachmentId: `att-${index}`, storageKey: item.storageKey.replace(/^temp\//, ''), type: item.type,
        fileName: item.fileName, fileSize: item.fileSize
      })),
      receipts: [], sentAt: new Date().toISOString().slice(0, 19)
    }) });
    return;
  }
  const room = rooms.find(item => path.includes(item.conversationId));
  await route.fulfill({ json: baseResponse(room ?? null) });
}

// 1x1 PNG, du de trinh duyet ve anh that trong luoi anh.
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

/** Moi lan xin URL tai len, de test kiem tra ca nhom anh di trong mot lo. */
export const storageCalls: { presign: Array<Array<{ folder: string; fileName: string }>>; messages: unknown[] } = {
  presign: [],
  messages: []
};

async function handleFakeR2(route: Route): Promise<void> {
  if (route.request().method() === 'PUT') {
    await route.fulfill({ status: 200, body: '' });
    return;
  }
  await route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL });
}

async function handleApi(route: Route): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;

  if (path.endsWith('/storage-service/api/v1/files/presigned-url')) {
    const requests = request.postDataJSON() as Array<{ folder: string; fileName: string }>;
    storageCalls.presign.push(requests);
    await route.fulfill({ json: baseResponse(requests.map((item, index) => ({
      uploadUrl: `https://r2.test/upload/${index}`,
      objectKey: `temp/${item.folder}/${currentUser.userId}/${index}-${item.fileName}`
    }))) });
    return;
  }
  if (path.endsWith('/storage-service/api/v1/files')) {
    await route.fulfill({ contentType: 'text/plain', body: `https://r2.test/object/${url.searchParams.get('key')}` });
    return;
  }
  if (path.endsWith('/auth-service/api/v1/auth/me') || path.endsWith('/auth-service/api/v1/auth/refresh')) {
    await route.fulfill({ json: baseResponse(currentUser) });
    return;
  }
  if (path.includes('/auth-service/api/v1/users/')) {
    await route.fulfill({ json: baseResponse(postAuthor) });
    return;
  }
  if (path.endsWith('/notification-service/api/v1/notifications/unread-count')) {
    await route.fulfill({ json: baseResponse(0) });
    return;
  }
  if (path.endsWith('/notification-service/api/v1/notifications')) {
    await route.fulfill({ json: baseResponse({ meta: { page: 1, pageSize: 5, pages: 0, total: 0 }, result: [] }) });
    return;
  }
  if (path.endsWith('/venue-service/api/v1/venues')) {
    await route.fulfill({ json: baseResponse({ items: [], total: 0, page: 0, pageSize: 12, totalPages: 0 }) });
    return;
  }
  if (path.includes('/social-service/api/v1/social/conversations')) {
    await handleChat(route, path);
    return;
  }
  if (path.endsWith('/social-service/api/v1/social/posts/tags/trending')) {
    await route.fulfill({ json: baseResponse([
      { tag: 'caulong', postCount: 12, authorCount: 6 }, { tag: 'keocuoituan', postCount: 7, authorCount: 4 }, { tag: 'bongda', postCount: 5, authorCount: 3 }
    ]) });
    return;
  }
  if (path.endsWith('/social-service/api/v1/social/friends')) {
    await route.fulfill({ json: baseResponse([{
      friendshipId: '55555555-5555-4555-8555-555555555555', requesterId: currentUser.userId,
      addresseeId: postAuthor.userId, status: 'ACCEPTED', requestedAt: '2026-08-01T08:00:00', respondedAt: '2026-08-02T08:00:00'
    }]) });
    return;
  }
  if (path.endsWith('/social-service/api/v1/social/friends/requests/received')) {
    await route.fulfill({ json: baseResponse([{
      friendshipId: '66666666-6666-4666-8666-666666666666', requesterId: '77777777-7777-4777-8777-777777777777',
      addresseeId: currentUser.userId, status: 'PENDING', requestedAt: '2026-09-25T08:00:00'
    }]) });
    return;
  }
  if (path.endsWith('/social-service/api/v1/social/friends/requests/sent') || path.endsWith('/social-service/api/v1/social/blocks')) {
    await route.fulfill({ json: baseResponse([]) });
    return;
  }
  if (path.endsWith('/social-service/api/v1/social/follows/users/me/following')
    || path.endsWith('/social-service/api/v1/social/follows/users/suggestions')) {
    await route.fulfill({ json: baseResponse([]) });
    return;
  }
  if (path.includes('/social-service/api/v1/social/follows/users/')) {
    const userId = path.split('/').pop();
    await route.fulfill({ json: baseResponse({ userId, followed: false, followerCount: 12, followingCount: 4 }) });
    return;
  }
  if (path.includes('/social-service/api/v1/social/posts/authors/')) {
    await route.fulfill({ json: baseResponse({ authorId: path.split('/').at(-2), postCount: 3 }) });
    return;
  }
  if (path.endsWith('/social-service/api/v1/social/posts')) {
    await route.fulfill({ json: baseResponse({
      ...emptySpringPage,
      empty: false,
      totalElements: 1,
      totalPages: 1,
      numberOfElements: 1,
      content: [{
        postId: '44444444-4444-4444-8444-444444444444',
        authorId: postAuthor.userId,
        content: 'Cuối tuần này có ai muốn giao lưu cầu lông không? @Nguyễn Minh Anh vào đội mình nhé #caulong #keocuoituan',
        tags: ['caulong', 'keocuoituan'],
        mentions: [{ userId: currentUser.userId, name: 'Nguyễn Minh Anh' }],
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
        sport: 'BADMINTON',
        sharedPostId: null,
        sharedPost: null,
        sharedPostUnavailable: false,
        createdAt: '2026-09-08T08:00:00',
        updatedAt: '2026-09-08T08:00:00',
        publishedAt: '2026-09-08T08:00:00',
        attachments: [],
        likeCount: 2,
        commentCount: 0,
        shareCount: 0,
        likedByCurrentUser: false,
        savedByCurrentUser: false
      }]
    }) });
    return;
  }
  if (path.endsWith('/comments')) {
    await route.fulfill({ json: baseResponse(emptySpringPage) });
    return;
  }
  if (path.includes('/club-service/api/v1/clubs')) {
    await route.fulfill({ json: baseResponse(emptySpringPage) });
    return;
  }
  if (path.includes('/club-service/api/v1/tournaments')) {
    await route.fulfill({ json: baseResponse(emptySpringPage) });
    return;
  }

  await route.fulfill({ json: baseResponse(null) });
}

export async function mockGoatSportsApi(page: Page): Promise<void> {
  await page.route('https://api.goatsports.click/**', handleApi);
  await page.route('https://r2.test/**', handleFakeR2);
  await page.route('http://localhost:7070/**', handleApi);
  await page.route('http://127.0.0.1:7070/**', handleApi);
}
