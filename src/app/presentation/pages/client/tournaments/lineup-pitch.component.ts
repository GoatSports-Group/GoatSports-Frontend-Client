import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { SportType } from '@domain/models/club.model';
import { TournamentLineupModel } from '@domain/models/tournament.model';
import { Formation, LineupSplit, formationOf, shortName, splitLineup, surfaceOf } from './tournament-lineup';

export interface PitchTeam {
  name: string;
  lineups: readonly TournamentLineupModel[];
}

interface SideView extends LineupSplit {
  name: string;
  formation: Formation;
}

/**
 * Đội hình trên mặt sân. Một đội: cả mặt sân, khung thành ở dưới. Hai đội (xem trước trận): đội nhà nửa trên,
 * đội khách nửa dưới, mỗi đội có khung thành ở phía mình — giống sơ đồ đội hình của các trang tỉ số.
 */
@Component({
  selector: 'app-lineup-pitch',
  templateUrl: './lineup-pitch.component.html',
  styleUrls: ['./lineup-pitch.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class LineupPitchComponent {
  private readonly homeSignal = signal<PitchTeam | null>(null);
  private readonly awaySignal = signal<PitchTeam | null>(null);
  private readonly config = signal<{ sport?: SportType; playFormat?: string; onField: number }>({ onField: 1 });
  private readonly nameMap = signal<ReadonlyMap<string, string>>(new Map());

  @Input({ required: true }) set home(value: PitchTeam) { this.homeSignal.set(value); }
  @Input() set away(value: PitchTeam | null | undefined) { this.awaySignal.set(value ?? null); }
  @Input() set sport(value: SportType | undefined) { this.config.update(c => ({ ...c, sport: value })); }
  @Input() set playFormat(value: string | undefined) { this.config.update(c => ({ ...c, playFormat: value })); }
  @Input() set onField(value: number | undefined) { this.config.update(c => ({ ...c, onField: value ?? 1 })); }
  /** Tên thật theo playerId (tài khoản trong auth-service); không có thì dùng tên lưu trong đội hình. */
  @Input() set names(value: ReadonlyMap<string, string> | null | undefined) { this.nameMap.set(value ?? new Map()); }

  readonly surface = computed(() => surfaceOf(this.config().sport));
  readonly homeView = computed(() => this.view(this.homeSignal()));
  readonly awayView = computed(() => this.view(this.awaySignal()));

  label(line: TournamentLineupModel): string {
    return shortName(this.fullName(line));
  }

  fullName(line: TournamentLineupModel): string {
    return this.nameMap().get(line.playerId) || line.playerName || 'Người chơi';
  }

  private view(team: PitchTeam | null): SideView | null {
    if (!team) return null;
    const { playFormat, onField } = this.config();
    const formation = formationOf(playFormat, onField);
    return { name: team.name, formation, ...splitLineup(team.lineups, formation) };
  }
}
