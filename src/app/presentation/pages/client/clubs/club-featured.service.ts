import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, shareReplay, switchMap } from 'rxjs';
import { PageResult } from '@application/dto/base/base-response';
import { FeaturedClub, FeaturedClubQuery, SportType } from '@application/dto/club/club.dto';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { PLAYER_SPORT_PROFILE_REPOSITORY_TOKEN } from '@application/ports/persistence/player-sport-profile.repository';
import { AuthService } from '@presentation/services/auth.service';
import { ClubLocationDataService } from './club-location-data.service';
import { ClubCardView, sportLabel, toCardView } from './club-view.model';

export interface FeaturedClubView extends ClubCardView {
  /** "Cùng môn Cầu lông · 6 buổi sinh hoạt gần đây · thắng 64%" — vì sao CLB được gợi ý. */
  reason: string;
}

/**
 * CLB noi bat cho trang Cau lac bo va /clubs/featured: club-service xep hang (GOAT-DESIGN §7 Featured clubs),
 * client gui kem mon + ma tinh trong ho so the thao de cong diem va ghep dong ly do tu so lieu tra ve.
 */
@Injectable({ providedIn: 'root' })
export class ClubFeaturedService {
  private readonly repository = inject(ClubRepositoryPort);
  private readonly profiles = inject(PLAYER_SPORT_PROFILE_REPOSITORY_TOKEN);
  private readonly location = inject(ClubLocationDataService);
  private readonly auth = inject(AuthService);
  private viewer$?: Observable<FeaturedClubQuery>;
  private viewerUserId?: string | null;

  load(filters: Pick<FeaturedClubQuery, 'filterSport' | 'filterCity'>, page: number, size: number)
    : Observable<PageResult<FeaturedClubView>> {
    return this.viewerQuery().pipe(
      switchMap(viewer => this.repository.getFeaturedClubs({ ...viewer, ...filters }, page, size)),
      map(result => ({ ...result, items: result.items.map(item => this.toView(item)) }))
    );
  }

  /** Mon va tinh/thanh trong ho so the thao; khach hoac loi thi rong (xep hang chung). Nho theo tai khoan. */
  private viewerQuery(): Observable<FeaturedClubQuery> {
    const userId = this.auth.isAuthenticated ? this.auth.currentUser?.userId ?? null : null;
    if (!userId) return of({});
    if (!this.viewer$ || this.viewerUserId !== userId) {
      this.viewerUserId = userId;
      this.viewer$ = forkJoin({
        profiles: this.profiles.getMyProfiles().pipe(catchError(() => of([]))),
        provinces: this.location.provinces$
      }).pipe(
        map(({ profiles, provinces }) => {
          const codeByName = new Map(provinces.map(province => [province.name, province.code]));
          return {
            sports: [...new Set(profiles.map(profile => profile.sportType as SportType))],
            cities: [...new Set(profiles.map(profile => codeByName.get(profile.city ?? '')).filter((code): code is string => !!code))]
          };
        }),
        shareReplay(1)
      );
    }
    return this.viewer$;
  }

  private toView(item: FeaturedClub): FeaturedClubView {
    const card = toCardView(item.club);
    const reasons: string[] = [];
    if (item.sameSport) reasons.push(`Cùng môn ${sportLabel(item.club.sportType).toLowerCase()}`);
    if (item.sameCity) reasons.push('Cùng khu vực với bạn');
    if (item.recentActivities > 0) reasons.push(`${item.recentActivities} buổi sinh hoạt gần đây`);
    if ((item.club.matchCount ?? 0) >= 5) reasons.push(`thắng ${card.winRate}% sau ${item.club.matchCount} trận`);
    if (item.newMembers > 0) reasons.push(`+${item.newMembers} thành viên mới`);
    const reason = reasons.slice(0, 3).join(' · ');
    return { ...card, reason: reason.charAt(0).toUpperCase() + reason.slice(1) };
  }
}
