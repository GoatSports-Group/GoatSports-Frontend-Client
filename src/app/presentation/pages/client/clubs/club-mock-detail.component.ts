import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { SportType } from '@application/dto/club/club.dto';
import { NotifyService } from '@shared/components/notify/notify.service';
import { map } from 'rxjs';
import {
  ClubAction,
  DEFAULT_CLUB_BANNER,
  DEFAULT_CLUB_LOGO,
  findMockClub,
  MOCK_ACTIVITIES,
  sportLabel
} from './club-mock-data';

type ClubDetailTab = 'ACHIEVEMENTS' | 'ACTIVITIES' | 'MEMBERSHIP';

@Component({
  selector: 'app-club-mock-detail',
  templateUrl: './club-mock-detail.component.html',
  styleUrls: ['./club-mock-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class ClubMockDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly notify = inject(NotifyService);

  readonly defaultClubLogo = DEFAULT_CLUB_LOGO;
  readonly defaultClubBanner = DEFAULT_CLUB_BANNER;
  readonly activities = MOCK_ACTIVITIES.slice(0, 3);
  readonly localAction = signal<ClubAction | null>(null);
  readonly showRequestModal = signal(false);
  readonly selectedTab = signal<ClubDetailTab>('ACHIEVEMENTS');
  readonly tabOrder: readonly ClubDetailTab[] = ['ACHIEVEMENTS', 'ACTIVITIES', 'MEMBERSHIP'];
  readonly clubId = toSignal(
    this.route.paramMap.pipe(map(params => params.get('clubId'))),
    { initialValue: this.route.snapshot.paramMap.get('clubId') }
  );
  readonly club = computed(() => findMockClub(this.clubId()));
  readonly action = computed(() => this.localAction() ?? this.club()?.action ?? 'DETAIL');

  sportLabel(value: SportType): string { return sportLabel(value); }

  selectTab(tab: ClubDetailTab): void { this.selectedTab.set(tab); }

  handleTabKeydown(event: KeyboardEvent, currentTab: ClubDetailTab): void {
    const currentIndex = this.tabOrder.indexOf(currentTab);
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % this.tabOrder.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + this.tabOrder.length) % this.tabOrder.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = this.tabOrder.length - 1;
    else return;

    event.preventDefault();
    const nextTab = this.tabOrder[nextIndex];
    this.selectedTab.set(nextTab);
    const tabList = (event.currentTarget as HTMLElement).parentElement;
    (tabList?.querySelector(`[data-tab="${nextTab}"]`) as HTMLElement | null)?.focus();
  }

  join(): void {
    const club = this.club();
    if (!club || (this.action() !== 'JOIN' && this.action() !== 'REQUEST')) return;

    if (club.privacy === 'PRIVATE') {
      this.showRequestModal.set(true);
      return;
    }

    this.localAction.set('DETAIL');
    this.notify.success(`Đã tham gia ${club.name} trong bản xem trước.`, 'Mock data');
  }

  closeJoinRequest(): void { this.showRequestModal.set(false); }

  submitJoinRequest(message: string): void {
    const club = this.club();
    if (!club) return;
    this.localAction.set('PENDING');
    this.showRequestModal.set(false);
    this.notify.success(`Đã gửi lời giới thiệu ${message.length} ký tự đến ${club.name}.`, 'Mock data');
  }

  showMockNotice(message: string): void { this.notify.info(message, 'Mock data'); }
  useLogoFallback(event: Event): void { this.applyImageFallback(event, this.defaultClubLogo); }
  useBannerFallback(event: Event): void { this.applyImageFallback(event, this.defaultClubBanner); }

  private applyImageFallback(event: Event, fallback: string): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(fallback)) image.src = fallback;
  }
}
