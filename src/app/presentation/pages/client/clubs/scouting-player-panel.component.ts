import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { PlayerClubRelation, ScoutedPlayerModel } from '@application/dto/club/club.dto';
import { AvailabilityDay, formatWinRate, groupAvailability, initialsOf, skillLabel } from './scouting-view.model';

const NOTE_MAX = 280;

/** Ho so chi tiet cua mot nguoi choi tren bang tuyen thanh vien (rail ben phai / bottom sheet tren mobile). */
@Component({
  selector: 'app-scouting-player-panel',
  templateUrl: './scouting-player-panel.component.html',
  styleUrls: ['./scouting-player-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class ScoutingPlayerPanelComponent implements OnChanges {
  @Input({ required: true }) player!: ScoutedPlayerModel;
  @Input() relation: PlayerClubRelation = 'NONE';
  @Input() shortlisted = false;
  @Input() shortlistBusy = false;
  /** Undefined khi nguoi choi chua o danh sach theo doi. */
  @Input() note: string | undefined;
  @Input() savingNote = false;
  @Input() radiusKm = 25;

  @Output() readonly invite = new EventEmitter<ScoutedPlayerModel>();
  @Output() readonly toggleShortlist = new EventEmitter<ScoutedPlayerModel>();
  @Output() readonly saveNote = new EventEmitter<string>();
  @Output() readonly closed = new EventEmitter<void>();

  readonly noteMax = NOTE_MAX;
  readonly initials = initialsOf;
  readonly skillLabel = skillLabel;
  readonly formatWinRate = formatWinRate;

  noteDraft = '';
  days: AvailabilityDay[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['player']) this.days = groupAvailability(this.player.availabilities);
    if (changes['note'] || changes['player']) this.noteDraft = this.note ?? '';
  }

  get noteChanged(): boolean {
    return this.noteDraft.trim() !== (this.note ?? '').trim();
  }

  get record(): string {
    const p = this.player;
    return `${p.winCount ?? 0} - ${p.drawCount ?? 0} - ${p.lossCount ?? 0}`;
  }

  get relationLabel(): string {
    switch (this.relation) {
      case 'INVITED': return 'Đã gửi lời mời';
      case 'REQUESTED': return 'Đang xin vào CLB';
      case 'MEMBER': return 'Đã là thành viên';
      case 'BANNED': return 'Đang bị cấm khỏi CLB';
      default: return '';
    }
  }

  get fitTone(): 'high' | 'mid' | 'low' {
    const score = this.player.fitScore ?? 0;
    return score >= 75 ? 'high' : score >= 50 ? 'mid' : 'low';
  }

  distanceLabel(value?: number): string {
    return value == null ? '—' : `${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`;
  }
}
