import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { ExternalVenue, ExternalVenueDemand } from '@application/dto/venue/venue.dto';
import { VENUE_SEARCH_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-search.repository';
import { environment } from '@environments/environment';

const SPORT_LABELS: Record<string, string> = {
  FOOTBALL: 'Bóng đá', BADMINTON: 'Cầu lông', TENNIS: 'Tennis', BASKETBALL: 'Bóng rổ', VOLLEYBALL: 'Bóng chuyền',
  PICKLEBALL: 'Pickleball'
};

/**
 * Trang đích của lời mời admin gửi cho chủ sân ngoài hệ thống (`/claim/{externalVenueId}`, công khai): sân nào, bao nhiêu
 * người chơi đang chờ đặt online, bao nhiêu kèo đã chơi ở đó, và nút "Nhận quản lý sân này". Nút dẫn qua đăng ký
 * (hoặc đăng nhập) chủ sân rồi về `/admin/applications?claim={id}`: hồ sơ chủ sân điền sẵn từ sân này, duyệt xong sân
 * chuyển thành cơ sở của họ.
 */
@Component({
  selector: 'app-venue-claim',
  templateUrl: './venue-claim.component.html',
  styleUrls: ['./venue-claim.component.scss'],
  standalone: false
})
export class VenueClaimComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly venueSearchRepo = inject(VENUE_SEARCH_REPOSITORY_TOKEN);
  private readonly destroyRef = inject(DestroyRef);

  registerUrl = '';
  loginUrl = '';

  venue: ExternalVenue | null = null;
  demand: ExternalVenueDemand | null = null;
  loading = true;
  notFound = false;

  ngOnInit(): void {
    const venueId = this.route.snapshot.paramMap.get('externalVenueId') ?? '';
    // Đăng ký / đăng nhập xong thì app auth đưa chủ sân về đúng form hồ sơ nhận sân này (auth chỉ nhận đích trong admin).
    const claimUrl = encodeURIComponent(`${environment.adminApiUrl}/admin/applications?claim=${venueId}`);
    this.registerUrl = `${environment.authApiUrl}/register?accountType=VENUE_OWNER&redirect=${claimUrl}`;
    this.loginUrl = `${environment.authApiUrl}/login?redirect=${claimUrl}`;
    forkJoin({
      venue: this.venueSearchRepo.getExternalVenue(venueId).pipe(catchError(() => of(null))),
      demand: this.venueSearchRepo.getExternalVenueDemand(venueId).pipe(catchError(() => of(null)))
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ venue, demand }) => {
      this.venue = venue?.data ?? null;
      this.demand = demand?.data ?? null;
      this.notFound = !this.venue;
      this.loading = false;
    });
  }

  sportsOf(venue: ExternalVenue): string {
    return venue.sportTypes.map(sport => SPORT_LABELS[sport] ?? sport).join(' · ');
  }
}
