import { SportType } from '@domain/models/club.model';
import { TournamentLineupModel } from '@domain/models/tournament.model';

/** Mặt sân vẽ theo môn: cỏ (bóng đá), sàn gỗ (bóng rổ), sàn (bóng chuyền, cầu lông, tennis, pickleball). */
export type SurfaceKind = 'pitch' | 'hardwood' | 'court';

export interface Formation {
  /** Số người mỗi hàng, tính từ khung thành / rổ / cuối sân của đội ra phía đối phương. */
  rows: number[];
  label: string;
}

/**
 * Sơ đồ dự kiến theo hình thức thi đấu. Dữ liệu đội hình không lưu vị trí, nên cầu thủ được xếp theo số áo tăng dần
 * (số 1 là thủ môn / người đầu tiên) — quy ước phổ biến và đủ để xem trước đội hình.
 */
const FORMATIONS: Readonly<Record<string, Formation>> = {
  FOOTBALL_5: { rows: [1, 2, 1, 1], label: '2-1-1' },
  FOOTBALL_7: { rows: [1, 3, 2, 1], label: '3-2-1' },
  FOOTBALL_11: { rows: [1, 4, 2, 3, 1], label: '4-2-3-1' },
  BASKETBALL_3X3: { rows: [1, 2], label: '3x3' },
  BASKETBALL_5X5: { rows: [1, 2, 2], label: '1-2-2' },
  VOLLEYBALL_6: { rows: [3, 3], label: '3-3' }
};

export function formationOf(playFormat: string | undefined, onField: number): Formation {
  const known = playFormat ? FORMATIONS[playFormat] : undefined;
  if (known) return known;
  // Đánh đơn / đánh đôi và dữ liệu cũ không có hình thức: một hàng đủ số người trên sân.
  return { rows: [Math.max(1, onField)], label: onField > 1 ? `${onField} người` : 'Đánh đơn' };
}

export function surfaceOf(sport: SportType | undefined): SurfaceKind {
  if (sport === 'FOOTBALL') return 'pitch';
  if (sport === 'BASKETBALL') return 'hardwood';
  return 'court';
}

export interface LineupSplit {
  /** Đội hình ra sân, đã chia theo hàng của sơ đồ. */
  rows: TournamentLineupModel[][];
  bench: TournamentLineupModel[];
  pending: TournamentLineupModel[];
}

/**
 * Chia đội hình: người đã nhận lời, không phải dự bị, xếp theo số áo, lấy đủ số người trên sân rồi rải vào các hàng.
 * Người còn lại ngồi dự bị; người chưa nhận lời tách riêng (chưa được tính vào đội).
 */
export function splitLineup(lineups: readonly TournamentLineupModel[], formation: Formation): LineupSplit {
  const accepted = lineups.filter(line => (line.memberStatus ?? 'ACCEPTED') === 'ACCEPTED');
  const byShirt = (a: TournamentLineupModel, b: TournamentLineupModel) =>
    (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999);
  const onField = formation.rows.reduce((sum, size) => sum + size, 0);
  const candidates = accepted.filter(line => line.lineupRole !== 'SUBSTITUTE').sort(byShirt);
  const starters = candidates.slice(0, onField);
  const bench = [...candidates.slice(onField), ...accepted.filter(line => line.lineupRole === 'SUBSTITUTE')].sort(byShirt);

  const rows: TournamentLineupModel[][] = [];
  let cursor = 0;
  for (const size of formation.rows) {
    if (cursor >= starters.length) break;
    rows.push(starters.slice(cursor, cursor + size));
    cursor += size;
  }
  return { rows, bench, pending: lineups.filter(line => line.memberStatus === 'INVITED') };
}

/** Tên gọn trên sân: hai chữ cuối của họ tên Việt ("Đặng Gia Huy" → "Gia Huy"). */
export function shortName(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  return words.length <= 2 ? fullName.trim() : words.slice(-2).join(' ');
}
