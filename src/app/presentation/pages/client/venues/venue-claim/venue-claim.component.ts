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
 * người chơi đang chờ đặt online, bao nhiêu kèo đã chơi ở đó, và nút đăng ký tài khoản chủ sân. Gắn hồ sơ chủ sân với
 * đúng sân này ("nhận quản lý sân") là bước sau; hiện nút dẫn vào đăng ký chủ sân thường.
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

  readonly registerUrl = `${environment.authApiUrl}/register?accountType=VENUE_OWNER`;
  readonly loginUrl = `${environment.authApiUrl}/login`;

  venue: ExternalVenue | null = null;
  demand: ExternalVenueDemand | null = null;
  loading = true;
  notFound = false;

  ngOnInit(): void {
    const venueId = this.route.snapshot.paramMap.get('externalVenueId') ?? '';
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
