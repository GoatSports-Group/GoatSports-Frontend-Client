import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import { TeamInvitation, TournamentRegistration } from '@application/dto/tournament/tournament.dto';
import { AuthService } from '@presentation/services/auth.service';
import { PlayerDirectoryService } from '@presentation/services/player-directory.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { LINEUP_ROLE_LABEL, SPORT_LABEL } from './tournament-view';

/**
 * Loi moi vao doi dang cho toi tra loi. Tren trang danh sach: moi loi moi; tren trang giai: chi giai do.
 * Khong co loi moi thi khong ve gi.
 */
@Component({
  selector: 'app-tournament-invitations',
  templateUrl: './tournament-invitations.component.html',
  styleUrls: ['./tournament-invitations.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class TournamentInvitationsComponent implements OnInit {
  private readonly repository = inject(TournamentRepositoryPort);
  private readonly auth = inject(AuthService);
  private readonly directory = inject(PlayerDirectoryService);
  private readonly notify = inject(NotifyService);

  /** Loc theo mot giai (trang chi tiet). */
  @Input() tournamentId: string | null = null;
  @Output() readonly answered = new EventEmitter<TournamentRegistration>();

  readonly sportLabel = SPORT_LABEL;
  readonly roleLabel = LINEUP_ROLE_LABEL;
  readonly invitations = signal<TeamInvitation[]>([]);
  readonly captains = signal<ReadonlyMap<string, string>>(new Map());
  readonly busyId = signal<string | null>(null);
  readonly visible = computed(() => this.invitations().filter(item =>
    !this.tournamentId || item.tournamentId === this.tournamentId));

  ngOnInit(): void { this.load(); }

  load(): void {
    if (!this.auth.currentUser) return;
    this.repository.getMyInvitations().subscribe({
      next: items => {
        this.invitations.set(items);
        this.directory.resolve(items.map(item => item.captainId)).subscribe(users => this.captains.set(
          new Map([...users].map(([id, user]) => [id, user.fullName || user.email || 'Đội trưởng']))));
      },
      error: () => undefined
    });
  }

  respond(invitation: TeamInvitation, accept: boolean): void {
    if (this.busyId()) return;
    this.busyId.set(invitation.registrationId);
    this.repository.respondInvitation(invitation.tournamentId, invitation.registrationId, accept).subscribe({
      next: registration => {
        this.busyId.set(null);
        // Nhan loi mot doi thi backend tu choi cac loi moi khac cung giai.
        this.invitations.update(items => items.filter(item =>
          accept ? item.tournamentId !== invitation.tournamentId : item.registrationId !== invitation.registrationId));
        this.notify.success(accept ? this.acceptedMessage(registration) : 'Đã từ chối lời mời.');
        this.answered.emit(registration);
      },
      error: error => {
        this.busyId.set(null);
        this.notify.error(error?.error?.message ?? 'Không trả lời được lời mời.');
        this.load();
      }
    });
  }

  private acceptedMessage(registration: TournamentRegistration): string {
    switch (registration.status) {
      case 'PENDING_PAYMENT': return 'Đã vào đội. Đội đủ người — đội trưởng cần đóng lệ phí trong 24 giờ.';
      case 'CONFIRMED': return 'Đã vào đội. Đội đã được xác nhận tham dự.';
      default: return 'Đã vào đội. Đội đang chờ thêm thành viên nhận lời.';
    }
  }
}
