import { SportType } from '@application/dto/club/club.dto';

export type ClubSortMode = 'RELEVANCE' | 'MEMBERS' | 'WIN_RATE';
export type ClubAction = 'DETAIL' | 'JOIN' | 'REQUEST' | 'PENDING';
export type ClubCity = string;

export interface MockClub {
  clubId: string;
  name: string;
  sportType: SportType;
  location: string;
  city: ClubCity;
  description: string;
  memberCount: number;
  winRate: number;
  wins: number;
  draws: number;
  losses: number;
  privacy: 'PUBLIC' | 'PRIVATE';
  activityLabel: string;
  schedule: string;
  homeVenue: string;
  foundedYear: number;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  action: ClubAction;
  featured?: boolean;
}

export interface MockInvitation {
  invitationId: string;
  club: MockClub;
  message: string;
  sentAt: string;
  type: 'INVITATION' | 'REQUEST';
}

export interface MockActivity {
  activityId: string;
  day: string;
  date: string;
  month: string;
  title: string;
  clubName: string;
  location: string;
  time: string;
  attendance: string;
  highlighted?: boolean;
}

export interface MockOpenMatch {
  matchId: string;
  title: string;
  location: string;
  schedule: string;
  neededPlayers: number;
  bannerUrl?: string | null;
}

export const DEFAULT_CLUB_LOGO = '/assets/images/goat.png';
export const DEFAULT_CLUB_BANNER = '/assets/images/default-banner-light.png';

export const CLUB_SPORTS: ReadonlyArray<{ label: string; value: SportType | 'ALL'; icon: string }> = [
  { label: 'Tất cả môn', value: 'ALL', icon: 'layout-grid' },
  { label: 'Bóng đá', value: 'FOOTBALL', icon: 'circle-dot' },
  { label: 'Bóng rổ', value: 'BASKETBALL', icon: 'circle-dot-dashed' },
  { label: 'Cầu lông', value: 'BADMINTON', icon: 'target' },
  { label: 'Tennis', value: 'TENNIS', icon: 'circle' },
  { label: 'Pickleball', value: 'PICKLEBALL', icon: 'swords' },
  { label: 'Bóng chuyền', value: 'VOLLEYBALL', icon: 'circle-dot' }
];

export const MOCK_CLUBS: MockClub[] = [
  {
    clubId: 'mock-saigon-city-fc',
    name: 'Saigon City FC',
    sportType: 'FOOTBALL',
    location: 'Quận 7, TP. Hồ Chí Minh',
    city: 'ho-chi-minh',
    description: 'Cộng đồng bóng đá phong trào đề cao tinh thần fair-play, sức khỏe và sự gắn kết qua những buổi tập đều đặn hằng tuần.',
    memberCount: 186,
    winRate: 72,
    wins: 26,
    draws: 6,
    losses: 8,
    privacy: 'PUBLIC',
    activityLabel: 'Hoạt động tích cực',
    schedule: 'Thứ Ba & Chủ nhật, 18:30 – 21:00',
    homeVenue: 'Sân bóng Phú Mỹ Hưng, Quận 7',
    foundedYear: 2021,
    logoUrl: null,
    bannerUrl: '/assets/images/default-banner-light.png',
    action: 'JOIN',
    featured: true
  },
  {
    clubId: 'mock-saigon-bounce',
    name: 'Saigon Bounce',
    sportType: 'BASKETBALL',
    location: 'Quận 1, TP. Hồ Chí Minh',
    city: 'ho-chi-minh',
    description: 'Chơi bóng rổ, kết bạn và nâng cao kỹ năng cùng cộng đồng luôn chào đón người mới.',
    memberCount: 124,
    winRate: 68,
    wins: 19,
    draws: 1,
    losses: 8,
    privacy: 'PUBLIC',
    activityLabel: '3 buổi mỗi tuần',
    schedule: 'Thứ Tư, thứ Sáu & Chủ nhật, 19:00',
    homeVenue: 'Nhà thi đấu Nguyễn Du, Quận 1',
    foundedYear: 2022,
    logoUrl: null,
    bannerUrl: null,
    action: 'JOIN'
  },
  {
    clubId: 'mock-sky-high-badminton',
    name: 'Sky High Badminton',
    sportType: 'BADMINTON',
    location: 'Quận Cầu Giấy, Hà Nội',
    city: 'ha-noi',
    description: 'Cộng đồng cầu lông thân thiện, sinh hoạt ba buổi mỗi tuần với huấn luyện viên hỗ trợ.',
    memberCount: 96,
    winRate: 64,
    wins: 16,
    draws: 0,
    losses: 9,
    privacy: 'PUBLIC',
    activityLabel: 'Sinh hoạt đều đặn',
    schedule: 'Thứ Hai, thứ Năm & thứ Bảy, 18:30',
    homeVenue: 'Nhà thi đấu Cầu Giấy, Hà Nội',
    foundedYear: 2020,
    logoUrl: null,
    bannerUrl: null,
    action: 'JOIN'
  },
  {
    clubId: 'mock-hanoi-runners',
    name: 'Hanoi Runners',
    sportType: 'VOLLEYBALL',
    location: 'Quận Tây Hồ, Hà Nội',
    city: 'ha-noi',
    description: 'Cùng chinh phục những cung đường đẹp và lan tỏa lối sống lành mạnh mỗi cuối tuần.',
    memberCount: 210,
    winRate: 61,
    wins: 14,
    draws: 2,
    losses: 7,
    privacy: 'PRIVATE',
    activityLabel: 'Cộng đồng năng động',
    schedule: 'Sáng thứ Bảy & Chủ nhật, 05:30',
    homeVenue: 'Công viên nước Hồ Tây, Hà Nội',
    foundedYear: 2019,
    logoUrl: null,
    bannerUrl: null,
    action: 'REQUEST'
  },
  {
    clubId: 'mock-west-lake-tennis',
    name: 'West Lake Tennis Club',
    sportType: 'TENNIS',
    location: 'Quận Tây Hồ, Hà Nội',
    city: 'ha-noi',
    description: 'Nhóm tennis giao lưu theo trình độ, có lịch đấu đôi và buổi hướng dẫn kỹ thuật hằng tuần.',
    memberCount: 78,
    winRate: 59,
    wins: 13,
    draws: 0,
    losses: 9,
    privacy: 'PRIVATE',
    activityLabel: 'Lịch chơi ổn định',
    schedule: 'Thứ Ba & thứ Bảy, 18:00',
    homeVenue: 'Cụm sân tennis Tây Hồ, Hà Nội',
    foundedYear: 2023,
    logoUrl: null,
    bannerUrl: null,
    action: 'REQUEST'
  },
  {
    clubId: 'mock-district-7-football',
    name: 'District 7 Football',
    sportType: 'FOOTBALL',
    location: 'Quận 7, TP. Hồ Chí Minh',
    city: 'ho-chi-minh',
    description: 'Đội bóng phong trào dành cho người đi làm, đá tối thứ Ba và sáng Chủ nhật hằng tuần.',
    memberCount: 142,
    winRate: 66,
    wins: 21,
    draws: 5,
    losses: 9,
    privacy: 'PUBLIC',
    activityLabel: '4 hoạt động mới',
    schedule: 'Thứ Ba, 20:00 & Chủ nhật, 07:00',
    homeVenue: 'Sân bóng Tân Quy, Quận 7',
    foundedYear: 2018,
    logoUrl: null,
    bannerUrl: '/assets/images/default-banner-light.png',
    action: 'JOIN'
  },
  {
    clubId: 'mock-da-nang-pickleball',
    name: 'Da Nang Pickleball Club',
    sportType: 'PICKLEBALL',
    location: 'Quận Hải Châu, Đà Nẵng',
    city: 'da-nang',
    description: 'Cộng đồng pickleball trẻ trung dành cho cả người mới lẫn người chơi muốn thi đấu giao hữu đều đặn.',
    memberCount: 112,
    winRate: 63,
    wins: 17,
    draws: 0,
    losses: 10,
    privacy: 'PUBLIC',
    activityLabel: 'Cộng đồng mới nổi',
    schedule: 'Thứ Tư & Chủ nhật, 18:00',
    homeVenue: 'Cụm sân Hải Châu, Đà Nẵng',
    foundedYear: 2023,
    logoUrl: null,
    bannerUrl: null,
    action: 'JOIN'
  },
  {
    clubId: 'mock-hue-volleyball',
    name: 'Hue Volleyball Community',
    sportType: 'VOLLEYBALL',
    location: 'Quận Thuận Hóa, TP. Huế',
    city: 'hue',
    description: 'Nhóm bóng chuyền giao lưu theo trình độ, ưu tiên tinh thần đồng đội và lịch tập ổn định mỗi tuần.',
    memberCount: 84,
    winRate: 58,
    wins: 14,
    draws: 1,
    losses: 9,
    privacy: 'PRIVATE',
    activityLabel: 'Tuyển thành viên',
    schedule: 'Thứ Ba & thứ Sáu, 19:00',
    homeVenue: 'Nhà thi đấu trung tâm TP. Huế',
    foundedYear: 2022,
    logoUrl: null,
    bannerUrl: null,
    action: 'REQUEST'
  },
  {
    clubId: 'mock-can-tho-basketball',
    name: 'Can Tho Basketball Club',
    sportType: 'BASKETBALL',
    location: 'Quận Ninh Kiều, Cần Thơ',
    city: 'can-tho',
    description: 'Sân chơi bóng rổ phong trào tại miền Tây với các buổi tập kỹ thuật và trận đấu nội bộ cuối tuần.',
    memberCount: 138,
    winRate: 69,
    wins: 20,
    draws: 0,
    losses: 9,
    privacy: 'PUBLIC',
    activityLabel: 'Hoạt động tích cực',
    schedule: 'Thứ Năm & Chủ nhật, 18:30',
    homeVenue: 'Nhà thi đấu Ninh Kiều, Cần Thơ',
    foundedYear: 2020,
    logoUrl: null,
    bannerUrl: null,
    action: 'JOIN'
  },
  {
    clubId: 'mock-quang-ninh-football',
    name: 'Quang Ninh Weekend FC',
    sportType: 'FOOTBALL',
    location: 'TP. Hạ Long, Quảng Ninh',
    city: 'quang-ninh',
    description: 'Đội bóng cuối tuần dành cho người đi làm, chú trọng fair-play và những trận giao hữu chất lượng.',
    memberCount: 104,
    winRate: 65,
    wins: 18,
    draws: 4,
    losses: 7,
    privacy: 'PUBLIC',
    activityLabel: 'Đá đều mỗi tuần',
    schedule: 'Chiều thứ Bảy, 16:30',
    homeVenue: 'Sân Cột 3, TP. Hạ Long',
    foundedYear: 2019,
    logoUrl: null,
    bannerUrl: null,
    action: 'JOIN'
  },
  {
    clubId: 'mock-nha-trang-tennis',
    name: 'Nha Trang Tennis',
    sportType: 'TENNIS',
    location: 'TP. Nha Trang, Khánh Hòa',
    city: 'khanh-hoa',
    description: 'Câu lạc bộ tennis ven biển tổ chức luyện tập, ghép cặp và thi đấu xếp hạng hằng tháng.',
    memberCount: 76,
    winRate: 62,
    wins: 16,
    draws: 0,
    losses: 10,
    privacy: 'PRIVATE',
    activityLabel: 'Thi đấu xếp hạng',
    schedule: 'Thứ Tư & thứ Bảy, 17:30',
    homeVenue: 'Cụm sân Phước Long, Nha Trang',
    foundedYear: 2021,
    logoUrl: null,
    bannerUrl: null,
    action: 'REQUEST'
  },
  {
    clubId: 'mock-hai-phong-badminton',
    name: 'Hai Phong Badminton',
    sportType: 'BADMINTON',
    location: 'Quận Lê Chân, Hải Phòng',
    city: 'hai-phong',
    description: 'Nhóm cầu lông đa trình độ có huấn luyện theo nhóm nhỏ và lịch giao lưu với các câu lạc bộ lân cận.',
    memberCount: 91,
    winRate: 67,
    wins: 18,
    draws: 0,
    losses: 9,
    privacy: 'PUBLIC',
    activityLabel: 'Lịch tập linh hoạt',
    schedule: 'Thứ Hai, thứ Năm & thứ Bảy, 19:00',
    homeVenue: 'Nhà thi đấu Lê Chân, Hải Phòng',
    foundedYear: 2022,
    logoUrl: null,
    bannerUrl: null,
    action: 'JOIN'
  }
];

export const MOCK_MY_CLUBS: MockClub[] = [
  {
    ...MOCK_CLUBS[3],
    clubId: 'mock-goat-runners',
    name: 'GOAT Runners',
    location: 'TP. Hồ Chí Minh',
    city: 'ho-chi-minh',
    memberCount: 68,
    activityLabel: 'Chủ CLB',
    action: 'DETAIL'
  },
  {
    ...MOCK_CLUBS[5],
    activityLabel: 'Thành viên',
    memberCount: 42
  }
];

export const MOCK_INVITATIONS: MockInvitation[] = [
  {
    invitationId: 'invite-west-lake',
    club: MOCK_CLUBS[4],
    message: 'Đã mời bạn tham gia',
    sentAt: '2 giờ trước',
    type: 'INVITATION'
  },
  {
    invitationId: 'request-saigon-basketball',
    club: { ...MOCK_CLUBS[1], clubId: 'mock-saigon-basketball', name: 'Saigon Basketball' },
    message: 'Yêu cầu đang chờ phê duyệt',
    sentAt: '1 ngày trước',
    type: 'REQUEST'
  }
];

export const MOCK_ACTIVITIES: MockActivity[] = [
  { activityId: 'activity-1', day: 'TH 7', date: '26', month: 'THG 9', title: 'Chạy dài cuối tuần', clubName: 'GOAT Runners', location: 'Công viên Thủ Thiêm, TP. Thủ Đức', time: '06:00 – 08:00', attendance: '12/20', highlighted: true },
  { activityId: 'activity-2', day: 'CN', date: '27', month: 'THG 9', title: 'Giao hữu với District 7 FC', clubName: 'District 7 Football', location: 'Sân Phú Mỹ Hưng, Quận 7', time: '19:00 – 21:00', attendance: '16/22' },
  { activityId: 'activity-3', day: 'TH 4', date: '30', month: 'THG 9', title: 'Cầu lông giao lưu', clubName: 'Sky High Badminton', location: 'Nhà thi đấu Cầu Giấy, Hà Nội', time: '18:30 – 20:30', attendance: '8/16' }
];

export const MOCK_OPEN_MATCHES: MockOpenMatch[] = [
  { matchId: 'match-1', title: 'Tìm đối giao hữu 5v5', location: 'Quận Bình Thạnh, TP. HCM', schedule: '26 Thg 9, 17:00', neededPlayers: 3, bannerUrl: '/assets/images/default-banner-light.png' },
  { matchId: 'match-2', title: 'Kèo cầu lông đôi nam nữ', location: 'Quận Cầu Giấy, Hà Nội', schedule: '28 Thg 9, 19:30', neededPlayers: 2, bannerUrl: null }
];

export function sportLabel(value: SportType): string {
  return CLUB_SPORTS.find(sport => sport.value === value)?.label ?? value;
}

export function findMockClub(clubId: string | null): MockClub | undefined {
  if (!clubId) return undefined;
  return [...MOCK_CLUBS, ...MOCK_MY_CLUBS].find(club => club.clubId === clubId);
}
