import { SportType } from '@application/dto/club/club.dto';

export type PlayerAvailability = 'WEEKDAY' | 'WEEKEND' | 'FLEXIBLE';

export interface ClubPlayerMock {
  userId: string;
  fullName: string;
  username: string;
  initials: string;
  sportType: SportType;
  city: string;
  district: string;
  level: string;
  availability: PlayerAvailability;
  availabilityLabel: string;
  recentActivity: string;
  mutualConnections: number;
}

export interface ClubReminderMock {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  note: string;
}

export const CLUB_PLAYER_MOCKS: readonly ClubPlayerMock[] = [
  { userId: 'player-01', fullName: 'Nguyễn Minh Khang', username: '@minhkhang.27', initials: 'MK', sportType: 'FOOTBALL', city: 'TP. Hồ Chí Minh', district: 'Quận 7', level: 'Khá', availability: 'WEEKEND', availabilityLabel: 'Cuối tuần', recentActivity: 'Hoạt động 2 giờ trước', mutualConnections: 8 },
  { userId: 'player-02', fullName: 'Trần Gia Hân', username: '@giahan.play', initials: 'GH', sportType: 'BADMINTON', city: 'TP. Hồ Chí Minh', district: 'Bình Thạnh', level: 'Trung bình', availability: 'WEEKDAY', availabilityLabel: 'Buổi tối trong tuần', recentActivity: 'Hoạt động hôm nay', mutualConnections: 5 },
  { userId: 'player-03', fullName: 'Lê Hoàng Nam', username: '@namhoang.10', initials: 'HN', sportType: 'FOOTBALL', city: 'TP. Hồ Chí Minh', district: 'TP. Thủ Đức', level: 'Nâng cao', availability: 'FLEXIBLE', availabilityLabel: 'Linh hoạt', recentActivity: 'Hoạt động 1 ngày trước', mutualConnections: 12 },
  { userId: 'player-04', fullName: 'Phạm Ngọc Anh', username: '@ngocanh.moves', initials: 'NA', sportType: 'BASKETBALL', city: 'Hà Nội', district: 'Cầu Giấy', level: 'Khá', availability: 'WEEKEND', availabilityLabel: 'Cuối tuần', recentActivity: 'Hoạt động 3 giờ trước', mutualConnections: 3 },
  { userId: 'player-05', fullName: 'Võ Quốc Bảo', username: '@quocbao.fit', initials: 'QB', sportType: 'PICKLEBALL', city: 'Đà Nẵng', district: 'Hải Châu', level: 'Mới chơi', availability: 'WEEKDAY', availabilityLabel: 'Buổi tối trong tuần', recentActivity: 'Hoạt động hôm qua', mutualConnections: 4 },
  { userId: 'player-06', fullName: 'Đặng Thùy Dương', username: '@duong.rally', initials: 'TD', sportType: 'TENNIS', city: 'TP. Hồ Chí Minh', district: 'Quận 2', level: 'Trung bình', availability: 'FLEXIBLE', availabilityLabel: 'Linh hoạt', recentActivity: 'Hoạt động 5 giờ trước', mutualConnections: 9 },
  { userId: 'player-07', fullName: 'Bùi Đức Huy', username: '@duchuy.volley', initials: 'DH', sportType: 'VOLLEYBALL', city: 'Hà Nội', district: 'Nam Từ Liêm', level: 'Khá', availability: 'WEEKEND', availabilityLabel: 'Cuối tuần', recentActivity: 'Hoạt động 2 ngày trước', mutualConnections: 2 },
  { userId: 'player-08', fullName: 'Mai Thanh Trúc', username: '@thanhtruc.sport', initials: 'TT', sportType: 'BADMINTON', city: 'Cần Thơ', district: 'Ninh Kiều', level: 'Nâng cao', availability: 'WEEKDAY', availabilityLabel: 'Buổi tối trong tuần', recentActivity: 'Hoạt động hôm nay', mutualConnections: 6 },
  { userId: 'player-09', fullName: 'Hồ Nhật Quang', username: '@nhatquang.fc', initials: 'NQ', sportType: 'FOOTBALL', city: 'TP. Hồ Chí Minh', district: 'Tân Bình', level: 'Khá', availability: 'FLEXIBLE', availabilityLabel: 'Linh hoạt', recentActivity: 'Hoạt động 4 giờ trước', mutualConnections: 11 },
  { userId: 'player-10', fullName: 'Ngô Yến Nhi', username: '@yennhi.hoop', initials: 'YN', sportType: 'BASKETBALL', city: 'TP. Hồ Chí Minh', district: 'Phú Nhuận', level: 'Trung bình', availability: 'WEEKEND', availabilityLabel: 'Cuối tuần', recentActivity: 'Hoạt động 1 ngày trước', mutualConnections: 7 },
  { userId: 'player-11', fullName: 'Trương Anh Tú', username: '@anhtu.court', initials: 'AT', sportType: 'TENNIS', city: 'Hà Nội', district: 'Tây Hồ', level: 'Mới chơi', availability: 'WEEKDAY', availabilityLabel: 'Buổi tối trong tuần', recentActivity: 'Hoạt động 3 ngày trước', mutualConnections: 1 },
  { userId: 'player-12', fullName: 'Đỗ Khánh Linh', username: '@khanhlinh.pb', initials: 'KL', sportType: 'PICKLEBALL', city: 'TP. Hồ Chí Minh', district: 'Quận 3', level: 'Khá', availability: 'FLEXIBLE', availabilityLabel: 'Linh hoạt', recentActivity: 'Hoạt động 6 giờ trước', mutualConnections: 10 },
  { userId: 'player-13', fullName: 'Lý Tuấn Kiệt', username: '@tuankiet.run', initials: 'TK', sportType: 'FOOTBALL', city: 'Bình Dương', district: 'Thủ Dầu Một', level: 'Trung bình', availability: 'WEEKEND', availabilityLabel: 'Cuối tuần', recentActivity: 'Hoạt động hôm qua', mutualConnections: 4 },
  { userId: 'player-14', fullName: 'Tạ Mỹ Linh', username: '@mylinh.smash', initials: 'ML', sportType: 'BADMINTON', city: 'Đà Nẵng', district: 'Sơn Trà', level: 'Nâng cao', availability: 'WEEKDAY', availabilityLabel: 'Buổi tối trong tuần', recentActivity: 'Hoạt động 2 giờ trước', mutualConnections: 8 }
];

export const CLUB_REMINDER_MOCKS: readonly ClubReminderMock[] = [
  { id: 'reminder-01', title: 'Buổi tập chiến thuật', date: '24 THG 9', time: '18:30 – 20:30', location: 'Sân sinh hoạt chính', note: 'Có mặt trước 15 phút để khởi động.' },
  { id: 'reminder-02', title: 'Giao hữu cuối tuần', date: '28 THG 9', time: '07:00 – 09:00', location: 'Địa điểm sẽ cập nhật', note: 'Mang áo sáng màu và nước cá nhân.' },
  { id: 'reminder-03', title: 'Họp nhanh thành viên', date: '02 THG 10', time: '20:00 – 20:30', location: 'Nhóm chat câu lạc bộ', note: 'Thống nhất lịch hoạt động tháng mới.' }
];
