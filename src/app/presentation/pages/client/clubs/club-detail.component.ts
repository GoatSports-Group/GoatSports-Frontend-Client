import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, OnDestroy, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, filter, forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { User } from '@application/dto/user/user.dto';
import {
  Club as ClubModel, ClubActivity as ClubActivityModel, ClubMember as ClubMemberModel,
  ClubPhoto as ClubPhotoModel,
  ClubRecentMatch as ClubRecentMatchModel,
  CreateClubActivityPayload, ClubRole,
  UpdateClubPayload, ClubPrivacy, ClubApprovalMode
} from '@application/dto/club/club.dto';
import { AuthService } from '@presentation/services/auth.service';
import { PlayerDirectoryService } from '@presentation/services/player-directory.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { StorageService } from '@presentation/services/storage.service';
import { NotificationService } from '@presentation/services/notification.service';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import {
  Tournament as TournamentModel, TournamentRegistration as TournamentRegistrationModel,
  TournamentStanding as TournamentStandingModel
} from '@application/dto/tournament/tournament.dto';
import { ClubCardView, DEFAULT_CLUB_BANNER, DEFAULT_CLUB_LOGO, sportLabel, toCardView } from './club-view.model';
import { ClubLocationDataService } from './club-location-data.service';

type ClubTab = 'OVERVIEW' | 'MEMBERS' | 'REQUESTS' | 'ACTIVITIES' | 'TOURNAMENTS' | 'GALLERY';
type ClubViewerState = 'MANAGER' | 'MEMBER' | 'PENDING' | 'GUEST';
interface PendingClubPhoto { file: File; previewUrl: string; }
@Component({
  selector: 'app-club-detail', templateUrl: './club-detail.component.html',
  styleUrls: ['./club-detail.component.scss'], changeDetection: ChangeDetectionStrategy.OnPush, standalone: false
})
export class ClubDetailComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly repository = inject(ClubRepositoryPort);
  private readonly tournamentRepository = inject(TournamentRepositoryPort);
  private readonly auth = inject(AuthService);
  private readonly directory = inject(PlayerDirectoryService);
  private readonly notify = inject(NotifyService);
  private readonly storage = inject(StorageService);
  private readonly notifications = inject(NotificationService);
  private readonly locationData = inject(ClubLocationDataService);
  private readonly destroyRef = inject(DestroyRef);
  readonly provinces = this.locationData.provinces;
  readonly clubId = this.route.snapshot.paramMap.get('clubId') ?? '';

  readonly club = signal<ClubModel | null>(null);
  readonly members = signal<ClubMemberModel[]>([]);
  readonly activities = signal<ClubActivityModel[]>([]);
  readonly clubPhotos = signal<ClubPhotoModel[]>([]);
  readonly pendingClubPhotos = signal<PendingClubPhoto[]>([]);
  readonly galleryUploading = signal(false);
  readonly photoPageLoading = signal(false);
  readonly photoPageError = signal(false);
  readonly photoTotal = signal(0);
  readonly photoHasMore = signal(true);
  readonly deletingPhotoIds = signal<ReadonlySet<string>>(new Set());
  private readonly optimisticClubPhotoUrls = signal<ReadonlyMap<string, string>>(new Map());
  readonly membership = signal<ClubMemberModel | null>(null);
  readonly users = signal<ReadonlyMap<string, User>>(new Map());
  readonly activeTab = signal<ClubTab>('OVERVIEW');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly mutating = signal(false);
  readonly showActivityModal = signal(false);
  readonly showJoinRequestModal = signal(false);
  readonly showLeaveConfirm = signal(false);
  readonly selectedActivity = signal<ClubActivityModel | null>(null);
  readonly selectedMatch = signal<ClubRecentMatchModel | null>(null);
  readonly showMemberMenu = signal(false);
  readonly showManagerMenu = signal(false);
  readonly showClubModal = signal(false);
  readonly clubLogoPreview = signal<string | null>(null);
  readonly clubBannerPreview = signal<string | null>(null);
  readonly editingActivityId = signal<string | null>(null);
  readonly defaultClubLogo = DEFAULT_CLUB_LOGO;
  readonly defaultClubBanner = DEFAULT_CLUB_BANNER;
  private readonly optimisticClubLogo = signal<string | null>(null);
  private readonly optimisticClubBanner = signal<string | null>(null);
  readonly displayedClubLogo = computed(() => this.optimisticClubLogo() || this.club()?.logoUrl || this.defaultClubLogo);
  readonly displayedClubBanner = computed(() => this.optimisticClubBanner() || this.club()?.bannerUrl || this.defaultClubBanner);
  readonly overviewClubPhotos = computed(() => this.clubPhotos().slice(0, 5));
  readonly photoOverflowCount = computed(() => Math.max(0, this.photoTotal() - 5));
  /**
   * auth.currentUser la getter thuong, khong phai signal, nen computed() khong theo doi no:
   * gia tri se bi ghim theo lan doc dau tien va chi tinh lai khi club() doi.
   * Doc qua currentUser$ de quyen chu CLB cap nhat dung khi phien dang nhap san sang sau.
   */
  private readonly currentUser = toSignal(this.auth.currentUser$, { initialValue: null });
  readonly isOwner = computed(() => {
    const ownerId = this.club()?.ownerId;
    const userId = this.currentUser()?.userId;
    return !!ownerId && !!userId && ownerId === userId;
  });
  readonly showDisbandConfirm = signal(false);
  readonly transferTarget = signal<ClubMemberModel | null>(null);
  readonly showOwnerLeaveNotice = signal(false);
  /** Chu CLB mot minh thi khong co ai de trao quyen; memberCount luon co san, con members() chi nap khi mo tab. */
  readonly hasSuccessorCandidate = computed(() => (this.club()?.memberCount ?? 0) > 1);
  readonly disbandConfirmText = signal('');
  readonly isDisbanded = computed(() => !!this.club()?.disbandedAt || this.club()?.active === false);
  /** Go dung ten CLB moi mo duoc nut: giai tan khong hoan tac duoc. */
  readonly disbandConfirmed = computed(() =>
    this.disbandConfirmText().trim().toLowerCase() === (this.club()?.name ?? '').trim().toLowerCase()
    && this.disbandConfirmText().trim().length > 0);
  readonly isManager = computed(() => this.isOwner() || (this.membership()?.status === 'ACTIVE' && this.membership()?.role === 'ADMIN'));
  readonly isActiveMember = computed(() => this.isOwner() || this.membership()?.status === 'ACTIVE');
  readonly viewerState = computed<ClubViewerState>(() => {
    if (this.isManager()) return 'MANAGER';
    if (this.isActiveMember()) return 'MEMBER';
    if (this.membership()?.status === 'PENDING') return 'PENDING';
    return 'GUEST';
  });
  readonly activeMembers = computed(() => this.members().filter(member => member.status === 'ACTIVE'));
  readonly pendingMembers = computed(() => this.members().filter(member => member.status === 'PENDING'));
  readonly memberPageLoading = signal(false);
  readonly memberPageError = signal(false);
  readonly memberTotal = signal(0);
  readonly memberHasMore = signal(true);
  readonly memberPreview = computed(() => this.activeMembers().slice(0, 7));
  readonly memberOverflowCount = computed(() => Math.max(0, this.memberTotal() - 7));
  readonly activityPageLoading = signal(false);
  readonly activityPageError = signal(false);
  readonly activityTotal = signal(0);
  readonly activityHasMore = signal(true);
  readonly sortedActivities = computed(() => [...this.activities()]
    .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime()));
  readonly recentMatches = signal<ReadonlyArray<ClubRecentMatchModel>>([]);
  readonly matchPageLoading = signal(false);
  readonly matchPageError = signal(false);
  readonly matchTotal = signal(0);
  readonly matchHasMore = signal(true);
  readonly tournament = signal<TournamentModel | null>(null);
  readonly tournamentTeams = signal<TournamentRegistrationModel[]>([]);
  readonly tournamentStandings = signal<TournamentStandingModel[]>([]);
  readonly clubTournamentRegistrationId = computed(() =>
    this.tournamentTeams().find(team => team.clubId === this.clubId)?.registrationId ?? null);
  readonly joinRequestClub = computed<ClubCardView | null>(() => {
    const current = this.club();
    return current ? toCardView(current) : null;
  });
  activityForm: CreateClubActivityPayload = { title: '', description: '', startAt: '', endAt: '' };
  clubForm: UpdateClubPayload = {
    name: '', description: '', city: '', location: '', tags: [], privacy: 'PUBLIC', approvalMode: 'AUTO'
  };
  private clubLogoFile: File | null = null;
  private clubBannerFile: File | null = null;
  private clubLogoObjectUrl: string | null = null;
  private clubBannerObjectUrl: string | null = null;
  private persistedClubLogoObjectUrl: string | null = null;
  private persistedClubBannerObjectUrl: string | null = null;
  private readonly memberLoadSentinel = viewChild<ElementRef<HTMLElement>>('memberLoadSentinel');
  private readonly activityLoadSentinel = viewChild<ElementRef<HTMLElement>>('activityLoadSentinel');
  private readonly matchLoadSentinel = viewChild<ElementRef<HTMLElement>>('matchLoadSentinel');
  private readonly photoLoadSentinel = viewChild<ElementRef<HTMLElement>>('photoLoadSentinel');
  private readonly memberPageSize = 7;
  private readonly activityPageSize = 3;
  private readonly matchPageSize = 3;
  private readonly photoPageSize = 12;
  private memberPage = 0;
  private activityPage = 0;
  private matchPage = 0;
  private photoPage = 0;

  constructor() {
    this.notifications.realtimeNotifications$
      .pipe(
        filter(notification => notification.referenceType === 'CLUB_DISBANDED'
          && notification.referenceId === this.clubId),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.redirectFromDisband());

    effect(onCleanup => {
      const sentinel = this.memberLoadSentinel()?.nativeElement;
      if (this.activeTab() !== 'MEMBERS' || !sentinel) return;
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) this.loadNextMemberPage();
      }, { rootMargin: '180px 0px' });
      observer.observe(sentinel);
      onCleanup(() => observer.disconnect());
    });

    effect(onCleanup => {
      const sentinel = this.activityLoadSentinel()?.nativeElement;
      if (this.activeTab() !== 'ACTIVITIES' || !sentinel) return;
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) this.loadNextActivityPage();
      }, { rootMargin: '180px 0px' });
      observer.observe(sentinel);
      onCleanup(() => observer.disconnect());
    });

    effect(onCleanup => {
      const sentinel = this.matchLoadSentinel()?.nativeElement;
      if (!sentinel) return;
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) this.loadNextMatchPage();
      }, { rootMargin: '120px 0px' });
      observer.observe(sentinel);
      onCleanup(() => observer.disconnect());
    });

    effect(onCleanup => {
      const sentinel = this.photoLoadSentinel()?.nativeElement;
      if (this.activeTab() !== 'GALLERY' || !sentinel) return;
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) this.loadNextPhotoPage();
      }, { rootMargin: '240px 0px' });
      observer.observe(sentinel);
      onCleanup(() => observer.disconnect());
    });

    if (this.clubId) {
      this.load();
      return;
    }

    this.error.set('Mã câu lạc bộ không hợp lệ.');
    this.loading.set(false);
  }

  ngOnDestroy(): void {
    this.clearPendingClubPhotos();
    this.releaseAllOptimisticClubPhotos();
    this.revokeClubLogoPreview();
    this.revokeClubBannerPreview();
    this.releasePersistedMediaPreview('logo');
    this.releasePersistedMediaPreview('banner');
  }

  load(): void {
    this.loading.set(true); this.error.set(null);
    this.resetActivityPagination();
    this.resetMatchPagination();
    this.resetPhotoPagination();
    const membershipRequest = this.auth.currentUser
      ? this.repository.getMyMembership(this.clubId).pipe(catchError(() => of(null))) : of(null);
    forkJoin({
      club: this.repository.getClubDetails(this.clubId),
      photos: this.repository.getClubPhotosPage(this.clubId, 0, this.photoPageSize).pipe(catchError(() => of({
        items: [], total: 0, page: 0, pageSize: this.photoPageSize, totalPages: 0
      }))),
      activities: this.repository.getClubActivitiesPage(this.clubId, 0, this.activityPageSize),
      matches: this.repository.getClubMatchesPage(this.clubId, 0, this.matchPageSize),
      membership: membershipRequest
    }).subscribe({
      next: data => {
        if (data.club.active === false || !!data.club.disbandedAt) {
          this.loading.set(false);
          this.redirectFromDisband();
          return;
        }
        this.club.set(data.club); this.clubPhotos.set(data.photos.items); this.members.set([]); this.activities.set(data.activities.items);
        this.photoTotal.set(data.photos.total);
        this.photoPage = 1;
        this.photoHasMore.set(this.photoPage < data.photos.totalPages);
        this.activityTotal.set(data.activities.total);
        this.activityPage = 1;
        this.activityHasMore.set(this.activityPage < data.activities.totalPages);
        this.recentMatches.set(data.matches.items);
        this.matchTotal.set(data.matches.total);
        this.matchPage = 1;
        this.matchHasMore.set(this.matchPage < data.matches.totalPages);
        this.loadTournamentContext(data.matches.items[0]?.tournamentId);
        this.membership.set(data.membership);
        if (this.route.snapshot.fragment === 'membership-requests' && this.isManager()) {
          this.activeTab.set('REQUESTS');
        }
        this.resetMemberPagination();
        this.loadNextMemberPage();
        if (this.isManager()) this.loadPendingMembers();
        this.loading.set(false); this.resolveUsers(data.club, []);
      },
      error: () => { this.error.set('Không thể tải thông tin câu lạc bộ.'); this.loading.set(false); }
    });
  }
  setTab(tab: ClubTab): void {
    this.activeTab.set(tab);
    if (tab === 'MEMBERS' && !this.activeMembers().length && !this.memberPageLoading()) {
      this.loadNextMemberPage();
    }
    if (tab === 'ACTIVITIES' && !this.activities().length && !this.activityPageLoading()) {
      this.loadNextActivityPage();
    }
    if (tab === 'TOURNAMENTS' && this.recentMatches().length <= this.matchPageSize && this.matchHasMore()) {
      this.loadNextMatchPage();
    }
    if (tab === 'GALLERY' && !this.clubPhotos().length && !this.photoPageLoading()) {
      this.loadNextPhotoPage();
    }
  }

  onClubPhotosSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!this.isOwner() || !files.length) return;
    if (files.length > 10) {
      this.notify.error('Mỗi lần chỉ được đăng tối đa 10 ảnh.');
      return;
    }

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const maxSize = 5 * 1024 * 1024;
    const invalidType = files.find(file => !allowedTypes.has(file.type));
    if (invalidType) {
      this.notify.error(`Ảnh ${invalidType.name} không đúng định dạng JPG, PNG hoặc WebP.`);
      return;
    }
    const oversized = files.find(file => !file.size || file.size > maxSize);
    if (oversized) {
      this.notify.error(`Ảnh ${oversized.name} phải nhỏ hơn hoặc bằng 5 MB.`);
      return;
    }

    this.clearPendingClubPhotos();
    this.pendingClubPhotos.set(files.map(file => ({ file, previewUrl: URL.createObjectURL(file) })));
  }

  removePendingClubPhoto(index: number): void {
    const pending = [...this.pendingClubPhotos()];
    const removed = pending.splice(index, 1)[0];
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    this.pendingClubPhotos.set(pending);
  }

  cancelClubPhotoUpload(): void {
    if (!this.galleryUploading()) this.clearPendingClubPhotos();
  }

  uploadClubPhotos(): void {
    const pending = this.pendingClubPhotos();
    if (!this.isOwner() || !pending.length || this.galleryUploading()) return;
    this.galleryUploading.set(true);
    this.storage.uploadImages(pending.map(item => item.file), 'clubs/gallery').pipe(
      switchMap(imageKeys => this.repository.addClubPhotos(this.clubId, imageKeys))
    ).subscribe({
      next: photos => {
        photos.forEach((photo, index) => {
          const previewUrl = pending[index]?.previewUrl;
          if (!previewUrl) return;
          this.optimisticClubPhotoUrls.update(current => new Map(current).set(photo.photoId, previewUrl));
          this.preloadClubPhoto(photo.photoId, previewUrl, photo.imageUrl, 0);
        });
        pending.slice(photos.length).forEach(item => URL.revokeObjectURL(item.previewUrl));
        this.pendingClubPhotos.set([]);
        this.clubPhotos.update(current => [...photos, ...current]);
        this.photoTotal.update(total => total + photos.length);
        this.photoPage = 0;
        this.photoHasMore.set(true);
        this.galleryUploading.set(false);
        this.notify.success(`Đã đăng ${photos.length} ảnh vào thư viện câu lạc bộ.`);
      },
      error: error => {
        this.galleryUploading.set(false);
        this.notify.error(error?.error?.message ?? 'Không thể đăng ảnh câu lạc bộ. Vui lòng thử lại.');
      }
    });
  }

  private clearPendingClubPhotos(): void {
    this.pendingClubPhotos().forEach(item => URL.revokeObjectURL(item.previewUrl));
    this.pendingClubPhotos.set([]);
  }

  clubPhotoUrl(photo?: ClubPhotoModel): string {
    if (!photo) return this.displayedClubBanner();
    return this.optimisticClubPhotoUrls().get(photo.photoId) || photo.imageUrl;
  }

  retryClubPhotoImage(event: Event, photo: ClubPhotoModel): void {
    if (this.optimisticClubPhotoUrls().has(photo.photoId)) return;
    const image = event.currentTarget as HTMLImageElement;
    const attempt = Number(image.dataset['retryAttempt'] ?? '0');
    if (attempt >= 6) return;
    image.dataset['retryAttempt'] = String(attempt + 1);
    const separator = photo.imageUrl.includes('?') ? '&' : '?';
    window.setTimeout(() => {
      image.src = `${photo.imageUrl}${separator}goatRetry=${Date.now()}`;
    }, Math.min(700 * 2 ** attempt, 3000));
  }

  private preloadClubPhoto(
    photoId: string,
    previewUrl: string,
    remoteUrl: string,
    attempt: number
  ): void {
    if (this.optimisticClubPhotoUrls().get(photoId) !== previewUrl) return;
    const image = new Image();
    image.onload = () => this.releaseOptimisticClubPhoto(photoId, previewUrl);
    image.onerror = () => {
      if (attempt >= 7) return;
      window.setTimeout(
        () => this.preloadClubPhoto(photoId, previewUrl, remoteUrl, attempt + 1),
        Math.min(700 * 2 ** attempt, 3000)
      );
    };
    const separator = remoteUrl.includes('?') ? '&' : '?';
    image.src = `${remoteUrl}${separator}goatPreload=${Date.now()}`;
  }

  private releaseOptimisticClubPhoto(photoId: string, expectedPreview?: string): void {
    const current = this.optimisticClubPhotoUrls();
    const previewUrl = current.get(photoId);
    if (!previewUrl || (expectedPreview && previewUrl !== expectedPreview)) return;
    const next = new Map(current);
    next.delete(photoId);
    this.optimisticClubPhotoUrls.set(next);
    URL.revokeObjectURL(previewUrl);
  }

  private releaseAllOptimisticClubPhotos(): void {
    this.optimisticClubPhotoUrls().forEach(previewUrl => URL.revokeObjectURL(previewUrl));
    this.optimisticClubPhotoUrls.set(new Map());
  }

  loadNextPhotoPage(): void {
    if (this.photoPageLoading() || !this.photoHasMore()) return;
    this.photoPageLoading.set(true);
    this.photoPageError.set(false);
    const requestedPage = this.photoPage;
    this.repository.getClubPhotosPage(this.clubId, requestedPage, this.photoPageSize).subscribe({
      next: page => {
        this.clubPhotos.update(current => {
          if (requestedPage === 0) return page.items;
          const known = new Set(current.map(item => item.photoId));
          return [...current, ...page.items.filter(item => !known.has(item.photoId))];
        });
        this.photoTotal.set(page.total);
        this.photoPage = requestedPage + 1;
        this.photoHasMore.set(this.photoPage < page.totalPages);
        this.photoPageLoading.set(false);
      },
      error: () => {
        this.photoPageLoading.set(false);
        this.photoPageError.set(true);
      }
    });
  }

  deleteClubPhoto(photo: ClubPhotoModel, event: Event): void {
    event.stopPropagation();
    if (!this.isOwner() || this.deletingPhotoIds().has(photo.photoId)) return;
    if (!window.confirm('Xóa ảnh này khỏi thư viện câu lạc bộ?')) return;

    this.deletingPhotoIds.update(ids => new Set(ids).add(photo.photoId));
    this.repository.deleteClubPhoto(this.clubId, photo.photoId).subscribe({
      next: () => {
        this.releaseOptimisticClubPhoto(photo.photoId);
        this.clubPhotos.update(items => items.filter(item => item.photoId !== photo.photoId));
        this.photoTotal.update(total => Math.max(0, total - 1));
        this.removeDeletingPhoto(photo.photoId);
        this.photoPage = 0;
        this.photoHasMore.set(true);
        this.loadNextPhotoPage();
        this.notify.success('Đã xóa ảnh khỏi thư viện câu lạc bộ.');
      },
      error: error => {
        this.removeDeletingPhoto(photo.photoId);
        this.notify.error(error?.error?.message ?? 'Không thể xóa ảnh. Vui lòng thử lại.');
      }
    });
  }

  private removeDeletingPhoto(photoId: string): void {
    this.deletingPhotoIds.update(ids => {
      const next = new Set(ids);
      next.delete(photoId);
      return next;
    });
  }

  loadNextMemberPage(): void {
    if (this.memberPageLoading() || !this.memberHasMore()) return;
    this.memberPageLoading.set(true);
    this.memberPageError.set(false);
    const requestedPage = this.memberPage;
    this.repository.getClubMembersPage(this.clubId, requestedPage, this.memberPageSize, 'ACTIVE').subscribe({
      next: page => {
        this.appendMembers(page.items);
        this.memberTotal.set(page.total);
        this.memberPage = requestedPage + 1;
        this.memberHasMore.set(this.memberPage < page.totalPages);
        this.memberPageLoading.set(false);
        this.resolveUsers(this.club(), page.items);
      },
      error: () => {
        this.memberPageLoading.set(false);
        this.memberPageError.set(true);
      }
    });
  }

  loadNextActivityPage(): void {
    if (this.activityPageLoading() || !this.activityHasMore()) return;
    this.activityPageLoading.set(true);
    this.activityPageError.set(false);
    const requestedPage = this.activityPage;
    this.repository.getClubActivitiesPage(this.clubId, requestedPage, this.activityPageSize).subscribe({
      next: page => {
        this.activities.update(items => {
          const known = new Set(items.map(item => item.activityId));
          return [...items, ...page.items.filter(item => !known.has(item.activityId))];
        });
        this.activityTotal.set(page.total);
        this.activityPage = requestedPage + 1;
        this.activityHasMore.set(this.activityPage < page.totalPages);
        this.activityPageLoading.set(false);
      },
      error: () => {
        this.activityPageLoading.set(false);
        this.activityPageError.set(true);
      }
    });
  }

  openActivityDetails(activity: ClubActivityModel): void { this.selectedActivity.set(activity); }

  closeActivityDetails(): void { this.selectedActivity.set(null); }

  openMatchDetails(match: ClubRecentMatchModel): void { this.selectedMatch.set(match); }

  closeMatchDetails(): void { this.selectedMatch.set(null); }

  onMatchScroll(event: Event): void {
    const container = event.currentTarget as HTMLElement | null;
    if (!container) return;
    const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (remaining <= 72) this.loadNextMatchPage();
  }

  loadNextMatchPage(): void {
    if (this.matchPageLoading() || !this.matchHasMore()) return;
    this.matchPageLoading.set(true);
    this.matchPageError.set(false);
    const requestedPage = this.matchPage;
    this.repository.getClubMatchesPage(this.clubId, requestedPage, this.matchPageSize).subscribe({
      next: page => {
        this.recentMatches.update(items => {
          const known = new Set(items.map(item => item.matchId));
          return [...items, ...page.items.filter(item => !known.has(item.matchId))];
        });
        this.matchTotal.set(page.total);
        this.matchPage = requestedPage + 1;
        this.matchHasMore.set(this.matchPage < page.totalPages);
        this.matchPageLoading.set(false);
        this.loadTournamentContext(page.items[0]?.tournamentId);
      },
      error: () => {
        this.matchPageLoading.set(false);
        this.matchPageError.set(true);
      }
    });
  }

  sportName(): string { return this.club() ? sportLabel(this.club()!.sportType) : ''; }

  locationLabel(): string {
    const current = this.club();
    return current?.location || current?.city || 'Chưa cập nhật địa điểm sinh hoạt';
  }

  roleLabel(): string {
    if (this.isOwner()) return 'Chủ CLB';
    if (this.isManager()) return 'Quản lý CLB';
    if (this.viewerState() === 'MEMBER') return 'Thành viên';
    if (this.viewerState() === 'PENDING') return 'Đang chờ duyệt';
    return 'Chưa tham gia';
  }

  hasAuthenticatedUser(): boolean { return Boolean(this.auth.currentUser); }

  /** Khong ai tu xoa/cam chinh minh duoc; roi CLB la chuc nang rieng. */
  isSelf(member: ClubMemberModel): boolean {
    return member.userId === this.currentUser()?.userId;
  }

  openPlayerSearch(): void { void this.router.navigate(['/clubs/my', this.clubId, 'players']); }

  /** Bam ra ngoai cum .member-more thi dong ca hai menu; bam trong cum de nut toggle con lam viec. */
  @HostListener('document:click', ['$event'])
  closeMenusOnOutsideClick(event: MouseEvent): void {
    if (!this.showManagerMenu() && !this.showMemberMenu()) return;
    if ((event.target as HTMLElement | null)?.closest('.member-more')) return;
    this.showManagerMenu.set(false);
    this.showMemberMenu.set(false);
  }

  @HostListener('document:keydown.escape')
  closeMenusOnEscape(): void {
    this.showManagerMenu.set(false);
    this.showMemberMenu.set(false);
  }

  requestDisband(): void {
    this.showManagerMenu.set(false);
    this.disbandConfirmText.set('');
    this.showDisbandConfirm.set(true);
  }

  disband(): void {
    if (this.mutating() || !this.disbandConfirmed()) return;
    this.mutating.set(true);
    this.repository.disbandClub(this.clubId).subscribe({
      next: () => {
        this.mutating.set(false);
        this.showDisbandConfirm.set(false);
        this.notify.success('Đã giải tán câu lạc bộ.');
        void this.router.navigate(['/clubs'], { replaceUrl: true });
      },
      error: error => {
        this.mutating.set(false);
        this.notify.error(error?.error?.message ?? 'Không thể giải tán câu lạc bộ.');
      }
    });
  }

  goToMyClubs(): void { void this.router.navigate(['/clubs/my']); }

  private redirectFromDisband(): void {
    void this.router.navigate(['/clubs'], { replaceUrl: true });
  }

  async shareClub(): Promise<void> {
    const current = this.club();
    if (!current) return;
    const shareData = {
      title: current.name,
      text: `Tham gia ${current.name} trên GOAT Sports.`,
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(shareData.url);
      this.notify.success('Đã sao chép liên kết câu lạc bộ.');
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') {
        this.notify.error('Không thể chia sẻ câu lạc bộ lúc này.');
      }
    }
  }

  requestTransferOwnership(member: ClubMemberModel): void {
    this.transferTarget.set(member);
  }

  confirmTransferOwnership(): void {
    const member = this.transferTarget();
    if (!member || this.mutating()) return;
    this.mutating.set(true);
    this.repository.transferOwnership(this.clubId, member.membershipId).subscribe({
      next: () => {
        this.mutating.set(false);
        this.transferTarget.set(null);
        this.notify.success(`Đã trao quyền chủ câu lạc bộ cho ${this.displayName(member.userId)}.`);
        this.load();
      },
      error: error => {
        this.mutating.set(false);
        this.notify.error(error?.error?.message ?? 'Không thể chuyển quyền sở hữu.');
      }
    });
  }

  promote(member: ClubMemberModel): void {
    const next: ClubRole = member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN';
    if (this.mutating()) return;
    this.mutating.set(true);
    this.repository.changeMemberRole(this.clubId, member.membershipId, next).subscribe({
      next: () => {
        this.mutating.set(false);
        this.notify.success(next === 'ADMIN' ? 'Đã phong quản trị viên.' : 'Đã gỡ quyền quản trị.');
        this.load();
      },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể đổi vai trò.'); }
    });
  }

  removeMember(member: ClubMemberModel, ban: boolean): void {
    if (this.mutating()) return;
    const question = ban
      ? 'Cấm thành viên này khỏi câu lạc bộ? Họ sẽ không tham gia lại được.'
      : 'Xóa thành viên này khỏi câu lạc bộ?';
    if (!window.confirm(question)) return;
    this.mutating.set(true);
    this.repository.removeMember(this.clubId, member.membershipId, ban).subscribe({
      next: () => {
        this.mutating.set(false);
        this.notify.success(ban ? 'Đã cấm thành viên.' : 'Đã xóa thành viên.');
        this.load();
      },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể xử lý thành viên.'); }
    });
  }

  editActivity(activity: ClubActivityModel): void {
    this.editingActivityId.set(activity.activityId);
    this.activityForm = {
      title: activity.title,
      description: activity.description ?? '',
      startAt: activity.startAt?.slice(0, 16) ?? '',
      endAt: activity.endAt?.slice(0, 16) ?? ''
    };
    this.showActivityModal.set(true);
  }

  deleteActivity(activity: ClubActivityModel): void {
    if (this.mutating() || !window.confirm('Xóa hoạt động này?')) return;
    this.mutating.set(true);
    this.repository.deleteClubActivity(this.clubId, activity.activityId).subscribe({
      next: () => {
        this.activities.update(items => items.filter(item => item.activityId !== activity.activityId));
        this.activityTotal.update(total => Math.max(0, total - 1));
        this.mutating.set(false);
        this.notify.success('Đã xóa hoạt động.');
      },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể xóa hoạt động.'); }
    });
  }

  closeActivityModal(): void {
    this.showActivityModal.set(false);
    this.editingActivityId.set(null);
    this.activityForm = { title: '', description: '', startAt: '', endAt: '' };
  }

  startJoin(): void {
    if (!this.auth.currentUser) {
      this.auth.notifyAuthenticationRequired('Vui lòng đăng nhập để tham gia câu lạc bộ.');
      return;
    }
    if (this.club()?.approvalMode === 'MANUAL') {
      this.showJoinRequestModal.set(true);
      return;
    }
    this.join();
  }

  join(message?: string): void {
    if (this.mutating()) return;
    this.mutating.set(true);
    this.repository.joinClub(this.clubId, message).subscribe({
      next: membership => {
        this.membership.set(membership);
        this.showJoinRequestModal.set(false);
        this.mutating.set(false);
        this.notify.success(membership.status === 'ACTIVE' ? 'Đã tham gia câu lạc bộ.' : 'Yêu cầu đang chờ duyệt.');
        this.load();
      },
      error: error => {
        this.mutating.set(false);
        this.notify.error(error?.error?.message ?? 'Không thể tham gia câu lạc bộ.');
      }
    });
  }
  requestLeave(): void {
    this.showMemberMenu.set(false);
    this.showManagerMenu.set(false);
    // Backend tu choi chu CLB roi di, nen khuyen truoc thay vi de ho bam roi an loi.
    if (this.isOwner()) {
      this.showOwnerLeaveNotice.set(true);
      return;
    }
    this.showLeaveConfirm.set(true);
  }

  pickSuccessor(): void {
    this.showOwnerLeaveNotice.set(false);
    this.setTab('MEMBERS');
  }

  disbandFromLeaveNotice(): void {
    this.showOwnerLeaveNotice.set(false);
    this.requestDisband();
  }

  leave(): void {
    if (this.mutating()) return; this.mutating.set(true);
    this.repository.leaveClub(this.clubId).subscribe({
      next: () => {
        this.showLeaveConfirm.set(false);
        this.mutating.set(false);
        this.membership.set(null);
        this.notify.success('Đã rời câu lạc bộ.');
        this.load();
      },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể rời câu lạc bộ.'); }
    });
  }
  respond(member: ClubMemberModel, accepted: boolean): void {
    this.repository.respondMembership(this.clubId, member.membershipId, accepted).subscribe({
      next: () => { this.notify.success(accepted ? 'Đã duyệt thành viên.' : 'Đã từ chối yêu cầu.'); this.load(); },
      error: error => this.notify.error(error?.error?.message ?? 'Không thể xử lý yêu cầu.')
    });
  }
  createActivity(): void {
    if (!this.activityForm.title.trim() || !this.activityForm.startAt || !this.activityForm.endAt) return;
    if (this.activityForm.endAt <= this.activityForm.startAt) {
      this.notify.warning('Thời điểm kết thúc phải sau thời điểm bắt đầu.');
      return;
    }
    this.mutating.set(true);
    const payload = { ...this.activityForm, title: this.activityForm.title.trim() };
    const editingId = this.editingActivityId();
    const request = editingId
      ? this.repository.updateClubActivity(this.clubId, editingId, payload)
      : this.repository.createClubActivity(this.clubId, payload);
    request.subscribe({
      next: activity => {
        this.activities.update(items => editingId
          ? items.map(item => item.activityId === editingId ? activity : item)
          : [activity, ...items]);
        if (!editingId) this.activityTotal.update(total => total + 1);
        this.mutating.set(false);
        this.closeActivityModal();
        this.notify.success(editingId ? 'Đã cập nhật hoạt động.' : 'Đã tạo hoạt động.');
      },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể lưu hoạt động.'); }
    });
  }
  openClubModal(): void {
    const current = this.club();
    if (!current) return;
    this.clubForm = {
      name: current.name,
      description: current.description ?? '',
      logoUrl: current.logoUrl ?? '',
      bannerUrl: current.bannerUrl ?? '',
      city: current.city ?? '',
      location: current.location ?? '',
      tags: [...(current.tags ?? [])],
      privacy: current.privacy,
      approvalMode: current.approvalMode
    };
    this.clubLogoPreview.set(this.displayedClubLogo());
    this.clubBannerPreview.set(this.displayedClubBanner());
    this.clubLogoFile = null;
    this.clubBannerFile = null;
    this.showClubModal.set(true);
  }

  saveClub(): void {
    if (this.mutating() || !this.clubForm.name?.trim()) return;
    const pendingLogoPreview = this.clubLogoFile ? this.clubLogoObjectUrl : null;
    const pendingBannerPreview = this.clubBannerFile ? this.clubBannerObjectUrl : null;
    this.mutating.set(true);
    forkJoin({
      logoUrl: this.clubLogoFile
        ? this.storage.uploadImage(this.clubLogoFile, 'clubs/logos')
        : of(this.clubForm.logoUrl),
      bannerUrl: this.clubBannerFile
        ? this.storage.uploadImage(this.clubBannerFile, 'clubs/banners')
        : of(this.clubForm.bannerUrl)
    }).pipe(
      switchMap(media => this.repository.updateClub(this.clubId, {
        ...this.clubForm,
        name: this.clubForm.name!.trim(),
        description: this.clubForm.description?.trim() ?? '',
        city: this.clubForm.city?.trim() ?? '',
        location: this.clubForm.location?.trim() ?? '',
        logoUrl: media.logoUrl,
        bannerUrl: media.bannerUrl
      }))
    ).subscribe({
      next: club => {
        this.club.set(club);
        if (pendingLogoPreview && club.logoUrl) {
          this.persistMediaPreviewUntilReady('logo', pendingLogoPreview, club.logoUrl);
        }
        if (pendingBannerPreview && club.bannerUrl) {
          this.persistMediaPreviewUntilReady('banner', pendingBannerPreview, club.bannerUrl);
        }
        this.mutating.set(false);
        this.closeClubModal();
        this.notify.success('Đã cập nhật câu lạc bộ.');
      },
      error: error => { this.mutating.set(false); this.notify.error(error?.error?.message ?? 'Không thể cập nhật câu lạc bộ.'); }
    });
  }

  onClubMediaSelected(event: Event, kind: 'logo' | 'banner'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const maxSize = 2 * 1024 * 1024;
    if (!allowedTypes.has(file.type)) {
      this.notify.error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
      input.value = '';
      return;
    }
    if (!file.size || file.size > maxSize) {
      this.notify.error('Ảnh phải nhỏ hơn 2 MB.');
      input.value = '';
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    if (kind === 'logo') {
      this.releasePersistedMediaPreview('logo');
      this.revokeClubLogoPreview();
      this.clubLogoFile = file;
      this.clubLogoObjectUrl = previewUrl;
      this.clubLogoPreview.set(previewUrl);
      this.optimisticClubLogo.set(previewUrl);
    } else {
      this.releasePersistedMediaPreview('banner');
      this.revokeClubBannerPreview();
      this.clubBannerFile = file;
      this.clubBannerObjectUrl = previewUrl;
      this.clubBannerPreview.set(previewUrl);
      this.optimisticClubBanner.set(previewUrl);
    }
    input.value = '';
  }

  closeClubModal(): void {
    this.showClubModal.set(false);
    this.revokeClubLogoPreview();
    this.revokeClubBannerPreview();
    this.clubLogoPreview.set(null);
    this.clubBannerPreview.set(null);
    this.clubLogoFile = null;
    this.clubBannerFile = null;
  }

  setPrivacy(value: string): void { this.clubForm.privacy = value as ClubPrivacy; }
  setApprovalMode(value: string): void { this.clubForm.approvalMode = value as ClubApprovalMode; }

  private revokeClubLogoPreview(): void {
    if (this.clubLogoObjectUrl) {
      if (this.optimisticClubLogo() === this.clubLogoObjectUrl) this.optimisticClubLogo.set(null);
      URL.revokeObjectURL(this.clubLogoObjectUrl);
    }
    this.clubLogoObjectUrl = null;
  }

  private revokeClubBannerPreview(): void {
    if (this.clubBannerObjectUrl) {
      if (this.optimisticClubBanner() === this.clubBannerObjectUrl) this.optimisticClubBanner.set(null);
      URL.revokeObjectURL(this.clubBannerObjectUrl);
    }
    this.clubBannerObjectUrl = null;
  }

  private persistMediaPreviewUntilReady(kind: 'logo' | 'banner', previewUrl: string, remoteUrl: string): void {
    this.releasePersistedMediaPreview(kind);
    if (kind === 'logo') {
      this.clubLogoObjectUrl = null;
      this.persistedClubLogoObjectUrl = previewUrl;
      this.optimisticClubLogo.set(previewUrl);
    } else {
      this.clubBannerObjectUrl = null;
      this.persistedClubBannerObjectUrl = previewUrl;
      this.optimisticClubBanner.set(previewUrl);
    }
    this.preloadPersistedMedia(kind, previewUrl, remoteUrl, 0);
  }

  private preloadPersistedMedia(
    kind: 'logo' | 'banner',
    previewUrl: string,
    remoteUrl: string,
    attempt: number
  ): void {
    const persistedPreview = kind === 'logo'
      ? this.persistedClubLogoObjectUrl
      : this.persistedClubBannerObjectUrl;
    if (persistedPreview !== previewUrl) return;

    const image = new Image();
    image.onload = () => {
      const currentPreview = kind === 'logo'
        ? this.persistedClubLogoObjectUrl
        : this.persistedClubBannerObjectUrl;
      if (currentPreview !== previewUrl) return;
      this.releasePersistedMediaPreview(kind);
    };
    image.onerror = () => {
      if (attempt >= 3) return;
      window.setTimeout(
        () => this.preloadPersistedMedia(kind, previewUrl, remoteUrl, attempt + 1),
        600 * 2 ** attempt
      );
    };
    image.src = remoteUrl;
  }

  private releasePersistedMediaPreview(kind: 'logo' | 'banner'): void {
    const previewUrl = kind === 'logo'
      ? this.persistedClubLogoObjectUrl
      : this.persistedClubBannerObjectUrl;
    if (!previewUrl) return;

    if (kind === 'logo') {
      if (this.optimisticClubLogo() === previewUrl) this.optimisticClubLogo.set(null);
      this.persistedClubLogoObjectUrl = null;
    } else {
      if (this.optimisticClubBanner() === previewUrl) this.optimisticClubBanner.set(null);
      this.persistedClubBannerObjectUrl = null;
    }
    URL.revokeObjectURL(previewUrl);
  }

  openChat(): void {
    const id = this.club()?.conversationId;
    if (id) {
      void this.router.navigate(['/chat', id]);
      return;
    }
    this.notify.warning('Nhóm tin nhắn của câu lạc bộ chưa sẵn sàng.');
  }

  tournamentTeamName(registrationId: string): string {
    return this.tournamentTeams().find(team => team.registrationId === registrationId)?.teamName || 'Đội tham dự';
  }

  isClubStanding(standing: TournamentStandingModel): boolean {
    return standing.registrationId === this.clubTournamentRegistrationId();
  }
  displayName(userId: string): string { return this.users().get(userId)?.fullName || this.users().get(userId)?.email || `Người dùng ${userId.slice(0, 8)}`; }
  avatar(userId: string): string | undefined { return this.users().get(userId)?.avatarUrl; }
  initials(value: string): string { return value.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }

  private resetMemberPagination(): void {
    this.memberPage = 0;
    this.memberTotal.set(0);
    this.memberHasMore.set(true);
    this.memberPageError.set(false);
  }

  private resetActivityPagination(): void {
    this.activityPage = 0;
    this.activityTotal.set(0);
    this.activityHasMore.set(true);
    this.activityPageError.set(false);
  }

  private resetMatchPagination(): void {
    this.matchPage = 0;
    this.matchTotal.set(0);
    this.matchHasMore.set(true);
    this.matchPageError.set(false);
    this.tournament.set(null);
    this.tournamentTeams.set([]);
    this.tournamentStandings.set([]);
  }

  private resetPhotoPagination(): void {
    this.photoPage = 0;
    this.photoTotal.set(0);
    this.photoHasMore.set(true);
    this.photoPageError.set(false);
  }

  private loadTournamentContext(tournamentId?: string): void {
    if (!tournamentId || this.tournament()?.tournamentId === tournamentId) return;
    forkJoin({
      tournament: this.tournamentRepository.getTournamentDetails(tournamentId),
      teams: this.tournamentRepository.getTournamentTeams(tournamentId),
      standings: this.tournamentRepository.getStandings(tournamentId)
    }).pipe(catchError(() => of(null))).subscribe(data => {
      if (!data) return;
      this.tournament.set(data.tournament);
      this.tournamentTeams.set(data.teams);
      this.tournamentStandings.set(data.standings);
    });
  }

  private loadPendingMembers(): void {
    this.repository.getClubMembersPage(this.clubId, 0, 50, 'PENDING').subscribe({
      next: page => {
        this.appendMembers(page.items);
        this.resolveUsers(this.club(), page.items);
      },
      error: () => this.notify.error('Không thể tải các yêu cầu tham gia.')
    });
  }

  private appendMembers(items: ClubMemberModel[]): void {
    this.members.update(current => {
      const byId = new Map(current.map(member => [member.membershipId, member]));
      items.forEach(member => byId.set(member.membershipId, member));
      return [...byId.values()];
    });
  }

  private resolveUsers(club: ClubModel | null, members: ClubMemberModel[]): void {
    const userIds = [...new Set([club?.ownerId, ...members.map(member => member.userId)]
      .filter((userId): userId is string => Boolean(userId)))];
    if (!userIds.length) return;
    this.directory.resolve(userIds).subscribe(users => this.users.update(current => {
      const merged = new Map(current);
      users.forEach((user, userId) => merged.set(userId, user));
      return merged;
    }));
  }
}
