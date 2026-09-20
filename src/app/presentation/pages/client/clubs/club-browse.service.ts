import { Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { MyClubMembership, SportType } from '@application/dto/club/club.dto';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { NotifyService } from '@shared/components/notify/notify.service';
import { ClubCardView, toCardView } from './club-view.model';

/**
 * Nguồn dữ liệu chung cho ba màn duyệt CLB: trang chính, "Nổi bật" và "Khám phá".
 *
 * <p>Gom lại một chỗ vì cả ba đều cần đúng một thứ: danh sách CLB **kèm tư cách thành viên
 * của tôi**, thiếu vế sau thì không biết nút nên là "Tham gia", "Gửi yêu cầu" hay "Đang chờ".
 */
@Injectable({ providedIn: 'root' })
export class ClubBrowseService {
  private readonly repository = inject(ClubRepositoryPort);
  private readonly notify = inject(NotifyService);

  readonly clubs = signal<ClubCardView[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly mutating = signal(false);

  load(sportType?: SportType, city?: string): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      clubs: this.repository.searchClubs(sportType, undefined, city),
      mine: this.repository.getMyClubs(),
      pending: this.repository.getMyPendingRequests()
    }).subscribe({
      next: data => {
        const memberships = new Map<string, MyClubMembership>(
          [...data.mine, ...data.pending].map(item => [item.club.clubId, item]));
        this.clubs.set(data.clubs.map(club => toCardView(club, memberships.get(club.clubId))));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Không tải được danh sách câu lạc bộ. Vui lòng thử lại.');
        this.loading.set(false);
      }
    });
  }

  /**
   * Backend tự quyết vào thẳng hay chờ duyệt theo approvalMode, client không đoán thay,
   * nên chỉ có một đường gửi cho cả hai kiểu CLB.
   */
  join(club: ClubCardView, onDone: () => void): void {
    if (this.mutating()) return;
    this.mutating.set(true);
    this.repository.joinClub(club.clubId).subscribe({
      next: member => {
        this.mutating.set(false);
        this.notify.success(member.status === 'ACTIVE'
          ? `Đã tham gia ${club.name}.`
          : `Đã gửi yêu cầu tham gia ${club.name}, chờ ban quản trị duyệt.`);
        onDone();
      },
      error: error => {
        this.mutating.set(false);
        this.notify.error(error?.error?.message ?? 'Không gửi được yêu cầu tham gia.');
      }
    });
  }
}
