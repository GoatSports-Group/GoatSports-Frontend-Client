/**
 * Kich thuoc trang chuan (GOAT-DESIGN §6 Pagination › Page size). Chon theo cach hien thi, khong theo tung trang.
 * Client va admin giu hai ban giong het nhau.
 */
export const PAGE_SIZE: Readonly<Record<'grid' | 'rows' | 'table' | 'stream' | 'streamLight' | 'chat', number>> = {
  /** Luoi the 4/3/2/1 cot: 12 chia het cho moi so cot nen hang cuoi luon day (3x4, 4x3, 6x2). */
  grid: 12,
  /** Danh sach dong trong mot the, phia nguoi choi (~10 dong x 72px vua mot man hinh). */
  rows: 10,
  /** Bang quan tri: van hanh can xem nhieu dong de so sanh. */
  table: 20,
  /** Cuon vo han, muc nang (bai viet, danh gia): moi lan tai them. */
  stream: 10,
  /** Cuon vo han, dong nhe (binh luan, hoi thoai, cua so render). */
  streamLight: 20,
  /** Tin nhan chat: rat ngan, tai it thi phai keo lien tuc. */
  chat: 50
};
