export interface ClubReminderMock {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  note: string;
}


export const CLUB_REMINDER_MOCKS: readonly ClubReminderMock[] = [
  { id: 'reminder-01', title: 'Buổi tập chiến thuật', date: '24 THG 9', time: '18:30 – 20:30', location: 'Sân sinh hoạt chính', note: 'Có mặt trước 15 phút để khởi động.' },
  { id: 'reminder-02', title: 'Giao hữu cuối tuần', date: '28 THG 9', time: '07:00 – 09:00', location: 'Địa điểm sẽ cập nhật', note: 'Mang áo sáng màu và nước cá nhân.' },
  { id: 'reminder-03', title: 'Họp nhanh thành viên', date: '02 THG 10', time: '20:00 – 20:30', location: 'Nhóm chat câu lạc bộ', note: 'Thống nhất lịch hoạt động tháng mới.' }
];
