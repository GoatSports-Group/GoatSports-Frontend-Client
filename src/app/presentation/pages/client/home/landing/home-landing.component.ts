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
import { catchError, map, of, timeout } from 'rxjs';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { VENUE_SEARCH_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-search.repository';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import { environment } from '@environments/environment';
import { authUrl, pageScroller, reducedMotion } from './landing-motion';

interface Stat {
  key: string;
  value: number | null;
  /** "50+" khi API chỉ trả tối đa 50 mục. */
  plus?: boolean;
  label: string;
}

/** Trọng số luật của AI ghép trận (matchmaking_scoring.SCORE_WEIGHTS) — con số thật, không phải minh họa. */
const AI_CRITERIA = [
  { label: 'Chênh lệch ELO', weight: 30 },
  { label: 'Khung giờ trùng nhau', weight: 25 },
  { label: 'Khoảng cách', weight: 15 },
  { label: 'Trình độ', weight: 10 },
  { label: 'Phong cách chơi', weight: 10 },
  { label: 'Vị trí ưa thích', weight: 5 },
  { label: 'Kinh nghiệm', weight: 5 }
];

/** Trang chủ cho khách: landing kể câu chuyện GoatSports bằng chuyển động, số liệu lấy từ API công khai. */
@Component({
  selector: 'app-home-landing',
  templateUrl: './home-landing.component.html',
  styleUrls: ['./home-landing.component.scss'],
  standalone: false
})
export class HomeLandingComponent implements OnInit, OnDestroy {
  private readonly venueSearch = inject(VENUE_SEARCH_REPOSITORY_TOKEN);
  private readonly clubRepo = inject(ClubRepositoryPort);
  private readonly tournamentRepo = inject(TournamentRepositoryPort);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private motion?: ReturnType<typeof gsap.context>;
  private counters?: ReturnType<typeof gsap.context>;

  readonly criteria = AI_CRITERIA;
  readonly sports = ['Bóng đá', 'Cầu lông', 'Pickleball', 'Tennis', 'Bóng rổ', 'Bóng chuyền'];
  readonly verbs = ['Đặt sân', 'Ghép trận', 'Câu lạc bộ', 'Giải đấu', 'ELO', 'Cộng đồng'];
  readonly stats = signal<Stat[]>([
    { key: 'venues', value: null, label: 'sân đang nhận đặt' },
    { key: 'clubs', value: null, label: 'câu lạc bộ đang hoạt động' },
    { key: 'tournaments', value: null, label: 'giải đấu mở đăng ký' },
    { key: 'sports', value: 6, label: 'môn thể thao' }
  ]);

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
    const settle = (key: string, value: number | null, plus = false) => {
      this.stats.update(items => items.map(item => item.key === key ? { ...item, value, plus } : item));
      requestAnimationFrame(() => this.countUp());
    };
    this.venueSearch.searchVenues({ page: 0, size: 1 }).pipe(
      map(res => res?.data?.total ?? null), timeout(15_000), catchError(() => of(null)), takeUntilDestroyed(this.destroyRef)
    ).subscribe(total => settle('venues', total));
    this.clubRepo.searchClubs().pipe(
      map(clubs => clubs.length), timeout(15_000), catchError(() => of(null)), takeUntilDestroyed(this.destroyRef)
    ).subscribe(count => settle('clubs', count, count === 50));
    this.tournamentRepo.searchTournaments({ status: 'REGISTRATION_OPEN' }, 0, 1).pipe(
      map(page => page.total), timeout(15_000), catchError(() => of(null)), takeUntilDestroyed(this.destroyRef)
    ).subscribe(total => settle('tournaments', total));
  }

  ngOnDestroy(): void {
    this.motion?.revert();
    this.counters?.revert();
  }

  /** Ô số liệu chỉ hiện khi có số thật (lỗi hoặc 0 thì ẩn, không bịa). */
  visibleStats(): Stat[] {
    return this.stats().filter(stat => stat.value === null || stat.value > 0);
  }

  private animate(): void {
    if (!this.browser || reducedMotion()) return;
    const root = this.host.nativeElement as HTMLElement;
    this.zone.runOutsideAngular(() => {
      gsap.registerPlugin(ScrollTrigger);
      const scroller = pageScroller(root);
      this.motion = gsap.context(() => {
        // Hero: từng dòng chữ trồi lên (không mặt nạ để giữ dấu tiếng Việt), ảnh nền zoom chậm rồi trôi theo cuộn.
        const intro = gsap.timeline({ defaults: { ease: 'power4.out' } });
        intro
          .from('.landing-hero__photo', { scale: 1.12, duration: 2.2, ease: 'power2.out' }, 0)
          .from('.landing-hero__line > span', { yPercent: 55, skewY: 7, autoAlpha: 0, duration: .9, stagger: .12 }, .1)
          .from('.landing-hero__underline path', { strokeDashoffset: 420, duration: .9, ease: 'power2.inOut' }, .65)
          .from('.landing-hero__lead, .landing-hero__actions, .landing-hero__login', { autoAlpha: 0, y: 16, duration: .6, stagger: .08 }, .55)
          .from('.float-card', { autoAlpha: 0, y: 40, scale: .94, duration: .9, stagger: .14, ease: 'back.out(1.4)' }, .7);

        gsap.to('.landing-hero__photo', {
          yPercent: 12, ease: 'none',
          scrollTrigger: { trigger: '.landing-hero', scroller, start: 'top top', end: 'bottom top', scrub: .6 }
        });

        // Thẻ nổi nghiêng nhẹ theo con trỏ (chỉ máy có chuột).
        if (window.matchMedia('(pointer: fine)').matches) {
          const hero = root.querySelector<HTMLElement>('.landing-hero');
          const layers = gsap.utils.toArray<HTMLElement>('.float-card').map((card, index) => ({
            x: gsap.quickTo(card, 'x', { duration: .8, ease: 'power3.out' }),
            y: gsap.quickTo(card, 'y', { duration: .8, ease: 'power3.out' }),
            depth: 14 + index * 10
          }));
          hero?.addEventListener('pointermove', event => {
            const box = hero.getBoundingClientRect();
            const dx = (event.clientX - box.left) / box.width - .5;
            const dy = (event.clientY - box.top) / box.height - .5;
            layers.forEach(layer => { layer.x(dx * layer.depth); layer.y(dy * layer.depth); });
          });
        }

        // Dải chữ chạy: chạy liên tục, nhanh lên và đổi chiều theo tốc độ cuộn.
        // Nội dung mỗi dải lặp 4 lần: trượt đúng một nửa rồi quay về là liền mạch. Dải thứ hai chạy ngược chiều.
        const rows = gsap.utils.toArray<HTMLElement>('.marquee__track').map((track, index) => index % 2
          ? gsap.fromTo(track, { xPercent: -50 }, { xPercent: 0, duration: 32, ease: 'none', repeat: -1 })
          : gsap.to(track, { xPercent: -50, duration: 28, ease: 'none', repeat: -1 }));
        ScrollTrigger.create({
          trigger: '.marquee', scroller, start: 'top bottom', end: 'bottom top',
          onUpdate: self => {
            const boost = gsap.utils.clamp(1, 6, 1 + Math.abs(self.getVelocity()) / 400);
            rows.forEach(row => gsap.to(row, { timeScale: boost, duration: .2, overwrite: true }));
          }
        });

        // Số liệu và các khối: hiện dần khi cuộn tới.
        ScrollTrigger.batch('.reveal', {
          scroller, start: 'top 88%', once: true,
          onEnter: items => gsap.from(items, { autoAlpha: 0, y: 28, duration: .7, stagger: .1, ease: 'power3.out',
            clearProps: 'opacity,visibility,transform' })
        });

        // Hành trình 4 bước: ghim section, trượt ngang theo cuộn dọc (màn rộng).
        gsap.matchMedia().add('(min-width: 1024px)', () => {
          const track = root.querySelector<HTMLElement>('.journey__track');
          if (!track) return;
          // Bỏ cuộn ngang mặc định để GSAP trượt dải; gỡ ra khi hiệu ứng tắt (màn hẹp lại, rời trang).
          root.classList.add('motion');
          track.scrollLeft = 0;
          const distance = () => track.scrollWidth - track.clientWidth;
          gsap.to(track, {
            x: () => -distance(), ease: 'none',
            scrollTrigger: {
              // Ghim ngay dưới header cố định 64px.
              trigger: '.journey', scroller, pin: true, scrub: .8, start: 'top 64px',
              end: () => `+=${distance()}`, invalidateOnRefresh: true,
              onUpdate: self => root.style.setProperty('--journey-progress', self.progress.toFixed(3))
            }
          });
          return () => root.classList.remove('motion');
        });

        // AI: các thanh trọng số chạy tới giá trị thật khi khối hiện ra.
        gsap.from('.criterion__bar b', {
          scaleX: 0, transformOrigin: 'left', duration: 1.1, stagger: .08, ease: 'power3.out',
          scrollTrigger: { trigger: '.ai-board', scroller, start: 'top 80%', once: true }
        });
      }, root);
    });
  }

  /** Đếm số thật từ 0 khi ô số liệu vào màn hình. */
  private countUp(): void {
    if (!this.browser || reducedMotion()) return;
    const root = this.host.nativeElement as HTMLElement;
    this.counters?.revert();
    this.zone.runOutsideAngular(() => this.counters = gsap.context(() => {
      root.querySelectorAll<HTMLElement>('[data-count]').forEach(element => {
        const target = Number(element.dataset['count']);
        const counter = { value: 0 };
        ScrollTrigger.create({
          trigger: element, scroller: pageScroller(root), start: 'top 92%', once: true,
          onEnter: () => gsap.to(counter, {
            value: target, duration: 1.4, ease: 'power2.out',
            onUpdate: () => { element.textContent = Math.round(counter.value).toLocaleString('vi-VN'); }
          })
        });
      });
    }, root));
  }
}
