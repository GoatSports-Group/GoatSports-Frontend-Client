import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
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
  @Input() pendingRequestCount = 0;
  @Output() readonly opened = new EventEmitter<MyClubMembership>();

  readonly defaultClubLogo = DEFAULT_CLUB_LOGO;
  readonly defaultClubBanner = DEFAULT_CLUB_BANNER;

  get isManager(): boolean { return this.item.role === 'OWNER' || this.item.role === 'ADMIN'; }
  get actionLabel(): string { return this.isManager ? 'Quản lý CLB' : 'Xem CLB'; }

  sportLabel(value: SportType): string { return sportLabel(value); }
  open(): void { this.opened.emit(this.item); }
  useLogoFallback(event: Event): void { this.applyImageFallback(event, this.defaultClubLogo); }
  useBannerFallback(event: Event): void { this.applyImageFallback(event, this.defaultClubBanner); }

  private applyImageFallback(event: Event, fallback: string): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(fallback)) image.src = fallback;
  }
}
