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
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, map, of, timeout, timer } from 'rxjs';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Booking } from '@application/dto/booking/booking.dto';
import { PlayerSportProfile } from '@application/dto/player-sport-profile/player-sport-profile.dto';
import { AiRepositoryPort } from '@application/ports/ai.repository.port';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/booking.repository';
import { FRIEND_REPOSITORY_TOKEN } from '@application/ports/persistence/friend.repository';
import { PLAYER_SPORT_PROFILE_REPOSITORY_TOKEN } from '@application/ports/persistence/player-sport-profile.repository';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import { ClubActivity as ClubActivityModel, ClubInvitation as ClubInvitationModel, MyClubMembership } from '@application/dto/club/club.dto';
import { MatchmakingSession as MatchmakingSessionModel } from '@application/dto/matchmaking/matchmaking.dto';
import { TeamInvitation as TeamInvitationModel, Tournament as TournamentModel } from '@application/dto/tournament/tournament.dto';
import { AuthService } from '@presentation/services/auth.service';
import {
  AgendaItem,
  AgendaKind,
  buildAgenda,
  buildTasks,
  dayLabel,
  frequentVenues,
  greeting,
  hhmm,
  sportLabel
} from './home-personal.utils';

/** Chu vi vòng đếm ngược (bán kính 34 trong viewBox 80). */
const CIRCUMFERENCE = 2 * Math.PI * 34;

/** Nguồn tải lỗi trả về FAILED thay vì làm hỏng cả trang; khối nào hết dữ liệu mới báo lỗi. */
const FAILED = Symbol('failed');
type Loaded<T> = T | typeof FAILED;

interface PersonalData {
  bookings: Loaded<Booking[]>;
  session: Loaded<MatchmakingSessionModel | null>;
  activities: Loaded<ClubActivityModel[]>;
  clubs: Loaded<MyClubMembership[]>;
  tournaments: Loaded<TournamentModel[]>;
  clubInvitations: Loaded<ClubInvitationModel[]>;
  teamInvitations: Loaded<TeamInvitationModel[]>;
  friendRequests: Loaded<number>;
  profiles: Loaded<PlayerSportProfile[]>;
}

const KIND_META: Record<AgendaKind, { label: string; icon: string }> = {
  BOOKING: { label: 'Đặt sân', icon: 'calendar-check' },
  MATCH: { label: 'Kèo AI', icon: 'swords' },
  CLUB: { label: 'CLB', icon: 'users' },
  TOURNAMENT: { label: 'Giải đấu', icon: 'trophy' }
};

const AGENDA_SOURCES: (keyof PersonalData)[] = ['bookings', 'session', 'activities', 'clubs', 'tournaments'];
const TASK_SOURCES: (keyof PersonalData)[] = ['bookings', 'session', 'clubInvitations', 'teamInvitations', 'friendRequests'];

function ok<T>(value: Loaded<T> | undefined, fallback: T): T {
  return value === undefined || value === FAILED ? fallback : value;
}

/** Mỗi nguồn về lúc nào thì gắn lúc đó; một khối chỉ chờ đúng những nguồn nó cần. */
function arrived(data: Partial<PersonalData>, keys: (keyof PersonalData)[]): boolean {
  return keys.every(key => key in data);
}

@Component({
  selector: 'app-home-personal',
  templateUrl: './home-personal.component.html',
  styleUrls: ['./home-personal.component.scss'],
  standalone: false
})
export class HomePersonalComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly bookingRepo = inject(BOOKING_REPOSITORY_TOKEN);
  private readonly ai = inject(AiRepositoryPort);
  private readonly clubRepo = inject(ClubRepositoryPort);
  private readonly tournamentRepo = inject(TournamentRepositoryPort);
  private readonly friendRepo = inject(FRIEND_REPOSITORY_TOKEN);
  private readonly profileRepo = inject(PLAYER_SPORT_PROFILE_REPOSITORY_TOKEN);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private animation?: ReturnType<typeof gsap.context>;
  private counters?: ReturnType<typeof gsap.context>;
  private loadVersion = 0;

  readonly kindMeta = KIND_META;
  readonly sportLabel = sportLabel;
  readonly hhmm = hhmm;
  readonly now = signal(new Date());
  readonly data = signal<Partial<PersonalData>>({});

  readonly firstName = computed(() => {
    const user = this.auth.currentUser;
    const name = user?.fullName?.trim() || user?.username || '';
    return name.split(/\s+/).slice(-2).join(' ');
  });
  readonly greeting = computed(() => greeting(this.now()));
  readonly today = computed(() => {
    const now = this.now();
    const weekday = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][now.getDay()];
    return `${weekday}, ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  });

  readonly agenda = computed(() => {
    const data = this.data();
    if (!arrived(data, AGENDA_SOURCES)) return null;
    const clubNames = new Map(ok(data.clubs, []).map(item => [item.club.clubId, item.club.name] as const));
    return buildAgenda({
      now: this.now(),
      userId: this.userId,
      bookings: ok(data.bookings, []),
      session: ok(data.session, null),
      activities: ok(data.activities, []),
      clubNames,
      tournaments: ok(data.tournaments, [])
    }, 12);
  });
  readonly agendaGroups = computed(() => {
    const groups: { label: string; items: AgendaItem[] }[] = [];
    for (const item of this.agenda() ?? []) {
      const label = dayLabel(item.start, this.now());
      const group = groups.at(-1);
      if (group?.label === label) group.items.push(item);
      else groups.push({ label, items: [item] });
    }
    return groups;
  });
  /** Một phần nguồn lịch lỗi: vẫn hiện phần đã có, kèm dòng báo để thử lại. */
  readonly agendaPartial = computed(() => {
    const data = this.data();
    return AGENDA_SOURCES.some(key => data[key] === FAILED);
  });
  readonly agendaFailed = computed(() => {
    const data = this.data();
    return arrived(data, AGENDA_SOURCES) && ['bookings', 'session', 'activities', 'tournaments']
      .every(key => data[key as keyof PersonalData] === FAILED);
  });
  readonly nextUp = computed(() => this.agenda()?.[0] ?? null);

  readonly tasks = computed(() => {
    const data = this.data();
    if (!arrived(data, TASK_SOURCES)) return null;
    return buildTasks({
      now: this.now(),
      userId: this.userId,
      bookings: ok(data.bookings, []),
      session: ok(data.session, null),
      clubInvitations: ok(data.clubInvitations, []),
      teamInvitations: ok(data.teamInvitations, []),
      friendRequests: ok(data.friendRequests, 0)
    });
  });
  readonly tasksPartial = computed(() => {
    const data = this.data();
    return TASK_SOURCES.some(key => data[key] === FAILED);
  });

  readonly profiles = computed(() => {
    return this.data().profiles ?? null;
  });
  readonly profileList = computed(() => {
    const profiles = this.profiles();
    return profiles && profiles !== FAILED
      ? [...profiles].sort((left, right) => right.matchCount - left.matchCount || right.eloRating - left.eloRating)
      : [];
  });
  readonly profilesFailed = computed(() => this.profiles() === FAILED);

  readonly venues = computed(() => {
    const bookings = this.data().bookings;
    if (bookings === undefined) return null;
    return bookings === FAILED ? FAILED : frequentVenues(bookings, this.now(), 10);
  });
  readonly venueList = computed(() => {
    const venues = this.venues();
    return venues && venues !== FAILED ? venues : [];
  });
  readonly venuesFailed = computed(() => this.venues() === FAILED);

  readonly summary = computed(() => {
    const agenda = this.agenda();
    const tasks = this.tasks();
    if (!agenda || !tasks) return 'Đang chuẩn bị lịch của bạn…';
    const parts = [
      agenda.length ? `${agenda.length} lịch sắp tới` : 'chưa có lịch sắp tới',
      tasks.length ? `${tasks.length} việc cần xử lý` : 'không có việc nào cần xử lý'
    ];
    return `Bạn có ${parts.join(' và ')}.`;
  });

  constructor() {
    afterNextRender(() => this.animateEntrance());
  }

  get userId(): string {
    return this.auth.currentUser?.userId ?? '';
  }

  ngOnInit(): void {
    this.load();
    // Đồng hồ cho đếm ngược "bắt đầu sau…" và hạn chót của việc cần xử lý.
    timer(30_000, 30_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.now.set(new Date()));
  }

  ngOnDestroy(): void {
    this.animation?.revert();
    this.counters?.revert();
  }

  load(): void {
    const version = ++this.loadVersion;
    this.data.set({});
    const sources: { [K in keyof PersonalData]: Observable<unknown> } = {
      bookings: this.bookingRepo.getMyBookingHistory(undefined, 0, 30).pipe(map(res => res?.data?.result ?? [])),
      session: this.ai.checkMatchmakingStatus().pipe(map(res => res.session ?? null)),
      activities: this.clubRepo.getMyUpcomingActivities(6),
      clubs: this.clubRepo.getMyClubs(),
      tournaments: this.tournamentRepo.getMyTournaments('PARTICIPATING', 0, 10).pipe(map(page => page.items)),
      clubInvitations: this.clubRepo.getMyInvitations(),
      teamInvitations: this.tournamentRepo.getMyInvitations(),
      friendRequests: this.friendRepo.getPendingReceived().pipe(map(res => res?.data?.length ?? 0)),
      profiles: this.profileRepo.getMyProfiles()
    };
    (Object.keys(sources) as (keyof PersonalData)[]).forEach(key => sources[key].pipe(
      timeout(20_000), // khung chờ không đứng mãi: quá hạn thì báo lỗi và cho thử lại
      catchError(() => of(FAILED)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(value => {
      if (version !== this.loadVersion) return; // phản hồi của lần tải cũ (đã bấm "Thử lại")
      this.now.set(new Date());
      this.data.update(current => ({ ...current, [key]: value }));
      // Đợi Angular vẽ xong thẻ hồ sơ rồi mới đếm số ELO.
      if (key === 'profiles') requestAnimationFrame(() => this.animateNumbers());
    }));
  }

  countdown(item: AgendaItem): string {
    const minutes = Math.round((item.start.getTime() - this.now().getTime()) / 60_000);
    if (minutes <= 0) return item.end.getTime() > this.now().getTime() ? 'Đang diễn ra' : 'Vừa kết thúc';
    if (minutes < 60) return `Bắt đầu sau ${minutes} phút`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Bắt đầu sau ${hours} giờ${minutes % 60 ? ` ${minutes % 60} phút` : ''}`;
    return `${dayLabel(item.start, this.now())} · ${item.allDay ? 'cả ngày' : hhmm(item.start)}`;
  }

  /** Vòng tiến độ: đầy dần trong 24 giờ trước giờ bắt đầu, đầy hẳn khi đang diễn ra. */
  ringOffset(item: AgendaItem): number {
    const remaining = item.start.getTime() - this.now().getTime();
    const fraction = remaining <= 0 ? 1 : Math.max(0.04, 1 - remaining / 86_400_000);
    return Math.round(CIRCUMFERENCE * (1 - fraction) * 10) / 10;
  }

  readonly circumference = CIRCUMFERENCE;

  deadlineLabel(deadline: Date | undefined): string | null {
    if (!deadline) return null;
    const minutes = Math.round((deadline.getTime() - this.now().getTime()) / 60_000);
    if (minutes <= 0) return 'Hết hạn';
    if (minutes < 60) return `Còn ${minutes} phút`;
    return dayLabel(deadline, this.now()) === 'Hôm nay' ? `Trước ${hhmm(deadline)}` : `Trước ${dayLabel(deadline, this.now())}`;
  }

  urgent(deadline: Date | undefined): boolean {
    return !!deadline && deadline.getTime() - this.now().getTime() < 60 * 60_000;
  }

  winPercent(profile: PlayerSportProfile): number {
    return Math.round((profile.winRate ?? 0) * 100);
  }

  playedLabel(date: Date): string {
    return `Gần nhất ${dayLabel(date, this.now()).toLowerCase()}`;
  }

  private animateEntrance(): void {
    if (!this.browser || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.zone.runOutsideAngular(() => {
      gsap.registerPlugin(ScrollTrigger);
      this.animation = gsap.context(() => {
        gsap.from('.today-hero__lead > *', { autoAlpha: 0, y: 14, duration: .32, stagger: .06, ease: 'power3.out' });
        gsap.from('.shortcut', { autoAlpha: 0, y: 12, duration: .32, stagger: .05, delay: .12, ease: 'power3.out' });
        gsap.from('.next-up', { autoAlpha: 0, x: 18, duration: .4, delay: .1, ease: 'power3.out' });
      }, this.host.nativeElement);
    });
  }

  /** ELO đếm từ 0 lên khi thẻ hồ sơ vào màn hình; thanh tỷ lệ thắng chạy bằng CSS. */
  private animateNumbers(): void {
    if (!this.browser || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.counters?.revert();
    this.zone.runOutsideAngular(() => this.counters = gsap.context(() => {
      const root = this.host.nativeElement as HTMLElement;
      root.querySelectorAll<HTMLElement>('[data-count-to]').forEach(element => {
        const target = Number(element.dataset['countTo']);
        const counter = { value: Math.round(target * .82) };
        ScrollTrigger.create({
          trigger: element,
          start: 'top 95%',
          once: true,
          onEnter: () => gsap.to(counter, {
            value: target, duration: .9, ease: 'power2.out',
            onUpdate: () => { element.textContent = String(Math.round(counter.value)); }
          })
        });
      });
    }, this.host.nativeElement));
  }
}

