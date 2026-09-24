import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import {
  Tournament as TournamentModel, TournamentFixture, TournamentRegistration, TournamentReservation
} from '@application/dto/tournament/tournament.dto';
import { FORMAT_LABEL, SPORT_LABEL, dayLabel } from './tournament-view';

/**
 * Xem trước / xem lại một trận: tỷ số, thời gian, sân và đội hình hai bên trên mặt sân.
 * Trận chưa biết đối thủ (vòng sau của loại trực tiếp) vẫn mở được để xem đội đã vào.
 */
@Component({
  selector: 'app-match-preview',
  templateUrl: './match-preview.component.html',
  styleUrls: ['./match-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class MatchPreviewComponent {
  @Input({ required: true }) fixture!: TournamentFixture;
  @Input({ required: true }) tournament!: TournamentModel;
  @Input() teams: ReadonlyMap<string, TournamentRegistration> = new Map();
  /** Tên đội theo registrationId. */
  @Input() names: ReadonlyMap<string, string> = new Map();
  /** Tên người chơi theo playerId (tài khoản thật). */
  @Input() playerNames: ReadonlyMap<string, string> = new Map();
  @Input() reservation: TournamentReservation | null = null;
  @Input() courtNames: ReadonlyMap<string, string> = new Map();
  @Input() venueName: string | null = null;
  @Output() readonly closed = new EventEmitter<void>();

  readonly sportLabel = SPORT_LABEL;
  readonly formatLabel = FORMAT_LABEL;
  readonly dayLabel = dayLabel;

  get home(): TournamentRegistration | undefined { return this.team(this.fixture.registration1Id); }
  get away(): TournamentRegistration | undefined { return this.team(this.fixture.registration2Id); }
  get isTeamEvent(): boolean { return this.tournament.participantType === 'TEAM'; }
  get isBye(): boolean { return !!this.fixture.registration1Id && !this.fixture.registration2Id && this.fixture.status === 'COMPLETED'; }

  get statusLabel(): string {
    if (this.isBye) return 'Được miễn thi đấu';
    if (this.fixture.status === 'COMPLETED') return 'Kết thúc';
    if (!this.fixture.registration1Id || !this.fixture.registration2Id) return 'Chờ xác định';
    return 'Sắp diễn ra';
  }

  sideName(id: string | undefined): string {
    if (id) return this.names.get(id) ?? 'Đội tham dự';
    return this.fixture.roundNumber > 1 ? 'Chờ đội thắng' : 'Miễn thi đấu';
  }

  isWinner(id: string | undefined): boolean {
    return !!id && this.fixture.winnerRegistrationId === id;
  }

  pitchTeam(registration: TournamentRegistration) {
    return { name: this.names.get(registration.registrationId) ?? registration.teamName ?? 'Đội', lineups: registration.lineups ?? [] };
  }

  close(): void { this.closed.emit(); }

  private team(id: string | undefined): TournamentRegistration | undefined {
    return id ? this.teams.get(id) : undefined;
  }
}
