import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  afterNextRender,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, timeout } from 'rxjs';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import { Club as ClubModel } from '@application/dto/club/club.dto';
import { Tournament as TournamentModel } from '@application/dto/tournament/tournament.dto';
import { environment } from '@environments/environment';
import { dayLabel, localDateTime, sportLabel, valid } from '../personal/home-personal.utils';
import { authUrl, pageScroller, reducedMotion } from './landing-motion';

type Strip<T> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; items: T[] };

/** Phần kết landing: giải đấu đang mở đăng ký, CLB đang hoạt động (API công khai) và lời mời tham gia. */
@Component({
  selector: 'app-home-landing-outro',
  templateUrl: './home-landing-outro.component.html',
  styleUrls: ['./home-landing-outro.component.scss'],
  standalone: false
})
export class HomeLandingOutroComponent implements OnInit, OnDestroy {
  private readonly clubRepo = inject(ClubRepositoryPort);
  private readonly tournamentRepo = inject(TournamentRepositoryPort);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private motion?: ReturnType<typeof gsap.context>;
  private readonly now = new Date();

  readonly sportLabel = sportLabel;
  readonly tournaments = signal<Strip<TournamentModel>>({ state: 'loading' });
  readonly clubs = signal<Strip<ClubModel>>({ state: 'loading' });

  constructor() {
    afterNextRender(() => this.animate());
  }

  get registerUrl(): string {
    return this.browser ? authUrl(environment.authApiUrl, 'register') : '';
  }

  get loginUrl(): string {
    return this.browser ? authUrl(environment.authApiUrl, 'login') : '';
  }

  ngOnInit(): void {
    this.loadTournaments();
    this.loadClubs();
  }

  ngOnDestroy(): void {
    this.motion?.revert();
  }

  loadTournaments(): void {
    this.tournaments.set({ state: 'loading' });
    this.tournamentRepo.searchTournaments({ status: 'REGISTRATION_OPEN', sort: 'registrationCloseDate,asc' }, 0, 10)
      .pipe(timeout(15_000), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => this.tournaments.set({ state: 'ready', items: page.items }),
        error: () => this.tournaments.set({ state: 'error' })
      });
  }

  loadClubs(): void {
    this.clubs.set({ state: 'loading' });
    this.clubRepo.searchClubs().pipe(
      // CLB đông thành viên nhất trước; bỏ CLB đã giải tán.
      map(clubs => clubs.filter(club => club.active && !club.disbandedAt)
        .sort((left, right) => right.memberCount - left.memberCount).slice(0, 12)),
      timeout(15_000),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: items => this.clubs.set({ state: 'ready', items }),
      error: () => this.clubs.set({ state: 'error' })
    });
  }

  items<T>(strip: Strip<T>): T[] {
    return strip.state === 'ready' ? strip.items : [];
  }

  closeLabel(tournament: TournamentModel): string {
    const close = localDateTime(tournament.registrationCloseDate);
    if (!valid(close)) return 'Đang mở đăng ký';
    const today = new Date(this.now.getFullYear(), this.now.getMonth(), this.now.getDate());
    const days = Math.round((close.getTime() - today.getTime()) / 86_400_000);
    if (days <= 0) return 'Hết hạn hôm nay';
    return days === 1 ? 'Hết hạn ngày mai' : `Còn ${days} ngày đăng ký`;
  }

  startLabel(tournament: TournamentModel): string {
    const start = localDateTime(tournament.startDate);
    return valid(start) ? `Khởi tranh ${dayLabel(start, this.now).toLowerCase()}` : 'Chưa chốt ngày khởi tranh';
  }

  fee(tournament: TournamentModel): string {
    return tournament.entryFee
      ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(tournament.entryFee)
      : 'Miễn phí';
  }

  filled(tournament: TournamentModel): number {
    return Math.min(100, Math.round(100 * (tournament.currentParticipants ?? 0) / Math.max(1, tournament.maxParticipants ?? 0)));
  }

  /** Backend có thể trả null cho số đội dù kiểu khai báo là number. */
  slots(tournament: TournamentModel): string {
    return `${tournament.currentParticipants ?? 0}/${tournament.maxParticipants ?? 0} đội`;
  }

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  private animate(): void {
    if (!this.browser || reducedMotion()) return;
    const root = this.host.nativeElement as HTMLElement;
    this.zone.runOutsideAngular(() => {
      gsap.registerPlugin(ScrollTrigger);
      const scroller = pageScroller(root);
      this.motion = gsap.context(() => {
        ScrollTrigger.batch('.outro-reveal', {
          scroller, start: 'top 88%', once: true,
          onEnter: items => gsap.from(items, { autoAlpha: 0, y: 28, duration: .7, stagger: .1, ease: 'power3.out',
            clearProps: 'opacity,visibility,transform' })
        });
        // Dòng chữ cuối phóng to dần theo cuộn.
        gsap.fromTo('.final-cta__title span', { scale: .82, opacity: .25 }, {
          scale: 1, opacity: 1, ease: 'none', stagger: .15,
          scrollTrigger: { trigger: '.final-cta', scroller, start: 'top 85%', end: 'center 55%', scrub: .6 }
        });
      }, root);
    });
  }
}
