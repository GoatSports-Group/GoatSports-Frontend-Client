import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import {
  TournamentFixture as TournamentFixtureModel, TournamentReservation
} from '@application/dto/tournament/tournament.dto';

export interface BracketRound {
  roundNumber: number;
  name: string;
  fixtures: TournamentFixtureModel[];
  /** Từng cặp trận cùng đổ vào một trận vòng sau (chung kết: một phần tử). */
  pairs: TournamentFixtureModel[][];
}

/**
 * Lich thi dau. Loai truc tiep: moi vong mot cot, tran vong sau nam giua hai tran nuoi no.
 * Chi hien thi; ty so do chu san cap nhat o khu dieu hanh.
 */
@Component({
  selector: 'app-tournament-bracket',
  templateUrl: './tournament-bracket.component.html',
  styleUrls: ['./tournament-bracket.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class TournamentBracketComponent {
  private readonly fixturesSignal = signal<TournamentFixtureModel[]>([]);
  private readonly reservationsSignal = signal<ReadonlyMap<string, TournamentReservation>>(new Map());

  @Input() set fixtures(value: TournamentFixtureModel[]) { this.fixturesSignal.set(value ?? []); }
  @Input() set reservations(value: readonly TournamentReservation[]) {
    this.reservationsSignal.set(new Map((value ?? []).map(item => [item.reservationId, item])));
  }
  /**
   * Ten doi theo registrationId. La Map (khong phai ham) de OnPush ve lai khi ten nguoi choi
   * tai xong muon hon lich dau.
   */
  @Input() names: ReadonlyMap<string, string> = new Map();
  /** Ten san theo courtId (giai dien ra tai mot co so), trang cha tai dan. */
  @Input() courtNames: ReadonlyMap<string, string> = new Map();
  /** Dang ky cua nguoi xem, to dam de tu tim thay minh. */
  @Input() highlightId: string | null = null;
  /** Mở xem trước trận (tỷ số, lịch, đội hình). */
  @Output() readonly open = new EventEmitter<TournamentFixtureModel>();

  readonly rounds = computed<BracketRound[]>(() => {
    const byRound = new Map<number, TournamentFixtureModel[]>();
    for (const fixture of this.fixturesSignal()) {
      const list = byRound.get(fixture.roundNumber) ?? [];
      list.push(fixture);
      byRound.set(fixture.roundNumber, list);
    }
    return [...byRound.entries()].sort(([a], [b]) => a - b).map(([roundNumber, fixtures]) => {
      const ordered = fixtures.sort((a, b) => a.matchNumber - b.matchNumber);
      const pairs: TournamentFixtureModel[][] = [];
      for (let index = 0; index < ordered.length; index += 2) pairs.push(ordered.slice(index, index + 2));
      return { roundNumber, name: ordered[0]?.roundName || `Vòng ${roundNumber}`, fixtures: ordered, pairs };
    });
  });

  readonly progress = computed(() => {
    const playable = this.fixturesSignal().filter(item => item.registration1Id && item.registration2Id);
    return { done: playable.filter(item => item.status === 'COMPLETED').length, total: playable.length };
  });

  isBye(fixture: TournamentFixtureModel): boolean {
    return !!fixture.registration1Id && !fixture.registration2Id && fixture.status === 'COMPLETED';
  }

  slotName(id: string | undefined, fixture: TournamentFixtureModel): string {
    if (id) return this.names.get(id) ?? 'Đội tham dự';
    return fixture.roundNumber > 1 ? 'Chờ đội thắng' : 'Miễn thi đấu';
  }

  schedule(fixture: TournamentFixtureModel): string | null {
    const reservation = fixture.reservationId ? this.reservationsSignal().get(fixture.reservationId) : undefined;
    if (!reservation) return null;
    // Ngay/gio dat truoc de khong bi cat; ten san o cuoi, dai thi ellipsis (du ten nam trong title).
    const [, month, day] = reservation.playDate.split('-');
    const court = this.courtNames.get(reservation.courtId);
    return `${day}/${month} · ${reservation.startTime.slice(0, 5)}–${reservation.endTime.slice(0, 5)}`
      + (court ? ` · ${court}` : '');
  }
}
