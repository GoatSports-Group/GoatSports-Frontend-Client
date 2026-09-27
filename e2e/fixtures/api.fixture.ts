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

async function handleApi(route: Route): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;

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
  if (path.endsWith('/social-service/api/v1/social/posts/tags/trending')) {
    await route.fulfill({ json: baseResponse([
      { tag: 'caulong', postCount: 12 }, { tag: 'keocuoituan', postCount: 7 }, { tag: 'bongda', postCount: 5 }
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
        mentions: [currentUser.userId],
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
  await page.route('http://localhost:7070/**', handleApi);
  await page.route('http://127.0.0.1:7070/**', handleApi);
}
