import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { MyClubMembership, SportType } from '@application/dto/club/club.dto';
import { DEFAULT_CLUB_BANNER, DEFAULT_CLUB_LOGO, sportLabel } from './club-view.model';

@Component({
  selector: 'app-my-club-card',
  templateUrl: './my-club-card.component.html',
  styleUrls: ['./my-club-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class MyClubCardComponent {
  @Input({ required: true }) item!: MyClubMembership;
  @Output() readonly opened = new EventEmitter<MyClubMembership>();
  @Output() readonly publicOpened = new EventEmitter<MyClubMembership>();
  @Output() readonly playerSearchOpened = new EventEmitter<MyClubMembership>();

  readonly menuOpen = signal(false);
  readonly defaultClubLogo = DEFAULT_CLUB_LOGO;
  readonly defaultClubBanner = DEFAULT_CLUB_BANNER;

  get isManager(): boolean { return this.item.role === 'OWNER' || this.item.role === 'ADMIN'; }
  get actionLabel(): string { return this.isManager ? 'Quản lý CLB' : 'Xem CLB'; }

  sportLabel(value: SportType): string { return sportLabel(value); }
  toggleMenu(event: Event): void { event.stopPropagation(); this.menuOpen.update(value => !value); }
  closeMenu(): void { this.menuOpen.set(false); }
  open(): void { this.closeMenu(); this.opened.emit(this.item); }
  openPublic(event: Event): void { event.stopPropagation(); this.closeMenu(); this.publicOpened.emit(this.item); }
  openPlayers(event: Event): void { event.stopPropagation(); this.closeMenu(); this.playerSearchOpened.emit(this.item); }
  useLogoFallback(event: Event): void { this.applyImageFallback(event, this.defaultClubLogo); }
  useBannerFallback(event: Event): void { this.applyImageFallback(event, this.defaultClubBanner); }

  private applyImageFallback(event: Event, fallback: string): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(fallback)) image.src = fallback;
  }
}
