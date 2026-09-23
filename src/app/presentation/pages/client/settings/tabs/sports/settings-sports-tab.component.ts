import { Component, OnInit, computed, inject } from '@angular/core';
import { finalize } from 'rxjs';
import {
  PLAYER_DAY_OPTIONS,
  PlayerSportProfile,
  PlayerDayOfWeek,
  SKILL_LEVEL_OPTIONS,
  SavePlayerAvailabilityRequest,
  SavePlayerSportProfileRequest,
  SkillLevel,
  SPORT_TYPE_OPTIONS,
  SportType
} from '@application/dto/player-sport-profile/player-sport-profile.dto';
import {
  PLAYER_SPORT_PROFILE_REPOSITORY_TOKEN,
  PlayerSportProfileRepository
} from '@application/ports/persistence/player-sport-profile.repository';
import { ClubLocationDataService, VietnamProvince } from '@presentation/pages/client/clubs/club-location-data.service';
import { CLUB_SPORTS } from '@presentation/pages/client/clubs/club-view.model';
import { SelectOption } from '@shared/components/ui/select/select.component';
import { NotifyService } from '@shared/components/notify/notify.service';

interface AvailabilityDraft extends SavePlayerAvailabilityRequest {
  clientId: number;
}

interface SportProfileDraft {
  sportType: SportType | null;
  skillLevel: SkillLevel;
  /** Đã thi đấu thì trình độ do ELO quyết định, người chơi không tự chọn nữa. */
  skillLocked: boolean;
  eloRating: number | null;
  preferredPositions: string;
  playStyle: string;
  /** Tên tỉnh/thành (khớp `vietnam-provinces.json`). */
  city: string;
  /** Tọa độ GPS chính xác; null = dùng trung tâm hành chính của `city`. */
  preciseLatitude: number | null;
  preciseLongitude: number | null;
  playRadiusKm: number;
  availabilities: AvailabilityDraft[];
}

const RADIUS_PRESETS_KM = [5, 10, 20, 30, 50];

@Component({
  selector: 'app-settings-sports-tab',
  templateUrl: './settings-sports-tab.component.html',
  styleUrls: ['./settings-sports-tab.component.scss'],
  standalone: false
})
export class SettingsSportsTabComponent implements OnInit {
  private readonly repository = inject<PlayerSportProfileRepository>(
    PLAYER_SPORT_PROFILE_REPOSITORY_TOKEN
  );
  private readonly notifyService = inject(NotifyService);
  private readonly locationData = inject(ClubLocationDataService);
  private nextClientId = 1;

  readonly sportOptions = SPORT_TYPE_OPTIONS;
  readonly skillSelectOptions: SelectOption[] = SKILL_LEVEL_OPTIONS.map(option => ({ ...option }));
  readonly daySelectOptions: SelectOption[] = PLAYER_DAY_OPTIONS.map(option => ({ ...option }));
  readonly cityOptions = computed<SelectOption[]>(() =>
    this.locationData.provinces().map(province => ({ value: province.name, label: province.name, icon: 'map-pin' }))
  );

  profiles: PlayerSportProfile[] = [];
  isLoading = true;
  loadFailed = false;
  isEditorOpen = false;
  isSaving = false;
  isLocating = false;
  cityTouched = false;
  editingProfileId: string | null = null;
  pendingDeleteId: string | null = null;
  deletingProfileId: string | null = null;
  draft = this.createEmptyDraft();

  ngOnInit(): void {
    this.loadProfiles();
  }

  get canAddSport(): boolean {
    return this.profiles.length < this.sportOptions.length;
  }

  /** Create mode lists every sport; sports that already have a profile are disabled (one profile per sport). */
  get sportSelectOptions(): SelectOption[] {
    return this.sportOptions.map(option => {
      const taken = this.profiles.some(profile => profile.sportType === option.value);
      return { value: option.value, label: taken ? `${option.label} · Đã có hồ sơ` : option.label, disabled: taken, icon: this.sportIcon(option.value) };
    });
  }

  get radiusOptions(): SelectOption[] {
    const values = new Set([...RADIUS_PRESETS_KM, this.draft.playRadiusKm]);
    return [...values].sort((a, b) => a - b).map(km => ({ value: km, label: `Trong bán kính ${km} km` }));
  }

  get isUsingPreciseLocation(): boolean {
    return this.draft.preciseLatitude !== null && this.draft.preciseLongitude !== null;
  }

  loadProfiles(): void {
    this.isLoading = true;
    this.loadFailed = false;
    this.repository.getMyProfiles().pipe(
      finalize(() => this.isLoading = false)
    ).subscribe({
      next: profiles => {
        this.profiles = profiles;
        this.sortProfiles();
      },
      error: () => this.loadFailed = true
    });
  }

  openCreate(): void {
    if (!this.canAddSport) return;
    this.editingProfileId = null;
    this.cityTouched = false;
    this.draft = this.createEmptyDraft();
    this.isEditorOpen = true;
  }

  openEdit(profile: PlayerSportProfile): void {
    const hasCoordinates = profile.latitude != null && profile.longitude != null;
    const city = profile.city
      || (hasCoordinates ? this.nearestProvince(profile.latitude!, profile.longitude!)?.name : undefined)
      || '';
    const centre = this.provinceByName(city);
    const isPrecise = hasCoordinates && (!centre
      || Math.abs(centre.latitude - profile.latitude!) > 0.001
      || Math.abs(centre.longitude - profile.longitude!) > 0.001);

    this.editingProfileId = profile.profileId;
    this.cityTouched = false;
    this.draft = {
      sportType: profile.sportType,
      skillLevel: profile.skillLevel,
      skillLocked: (profile.matchCount ?? 0) > 0,
      eloRating: profile.eloRating ?? null,
      preferredPositions: profile.preferredPositions.join(', '),
      playStyle: profile.playStyle || '',
      city,
      preciseLatitude: isPrecise ? profile.latitude! : null,
      preciseLongitude: isPrecise ? profile.longitude! : null,
      playRadiusKm: profile.playRadiusKm ?? 10,
      availabilities: profile.availabilities.map(slot => ({
        availabilityId: slot.availabilityId,
        dayOfWeek: slot.dayOfWeek,
        startTime: this.toTimeInput(slot.startTime),
        endTime: this.toTimeInput(slot.endTime),
        timezone: slot.timezone,
        active: slot.active,
        clientId: this.nextClientId++
      }))
    };
    this.pendingDeleteId = null;
    this.isEditorOpen = true;
  }

  closeEditor(): void {
    if (this.isSaving) return;
    this.isEditorOpen = false;
    this.editingProfileId = null;
  }

  onCityChange(city: string): void {
    this.draft.city = city;
    this.cityTouched = true;
    // A new city means a new area: drop GPS coordinates that belonged to the old one.
    this.clearPreciseLocation();
  }

  addAvailability(): void {
    this.draft.availabilities.push({
      clientId: this.nextClientId++,
      dayOfWeek: PlayerDayOfWeek.MONDAY,
      startTime: '18:00',
      endTime: '20:00',
      timezone: this.browserTimezone,
      active: true
    });
  }

  removeAvailability(index: number): void {
    this.draft.availabilities.splice(index, 1);
  }

  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.notifyService.error('Trình duyệt không hỗ trợ lấy vị trí hiện tại.');
      return;
    }
    this.isLocating = true;
    navigator.geolocation.getCurrentPosition(
      position => {
        this.isLocating = false;
        const latitude = Number(position.coords.latitude.toFixed(6));
        const longitude = Number(position.coords.longitude.toFixed(6));
        this.draft.preciseLatitude = latitude;
        this.draft.preciseLongitude = longitude;
        const nearest = this.nearestProvince(latitude, longitude);
        if (nearest) {
          this.draft.city = nearest.name;
          this.cityTouched = true;
        }
        this.notifyService.success(`Đã dùng vị trí hiện tại${nearest ? ` (${nearest.name})` : ''}.`);
      },
      () => {
        this.isLocating = false;
        this.notifyService.error('Không thể lấy vị trí. Hãy cấp quyền vị trí hoặc chọn tỉnh/thành phố.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  clearPreciseLocation(): void {
    this.draft.preciseLatitude = null;
    this.draft.preciseLongitude = null;
  }

  saveProfile(): void {
    if (this.isSaving) return;
    this.cityTouched = true;
    const payload = this.toPayload();
    if (!payload) return;

    this.isSaving = true;
    const request = this.editingProfileId
      ? this.repository.updateProfile(this.editingProfileId, payload)
      : this.repository.createProfile(payload);
    request.pipe(finalize(() => this.isSaving = false)).subscribe({
      next: saved => {
        const currentIndex = this.profiles.findIndex(profile => profile.profileId === saved.profileId);
        this.profiles = currentIndex >= 0
          ? this.profiles.map(profile => profile.profileId === saved.profileId ? saved : profile)
          : [...this.profiles, saved];
        this.sortProfiles();
        this.isEditorOpen = false;
        this.editingProfileId = null;
        this.notifyService.success('Đã lưu hồ sơ thể thao.');
      },
      error: error => this.notifyService.error(this.getErrorMessage(error))
    });
  }

  requestDelete(profileId: string): void {
    this.pendingDeleteId = profileId;
  }

  cancelDelete(): void {
    this.pendingDeleteId = null;
  }

  confirmDelete(profileId: string): void {
    if (this.deletingProfileId) return;
    this.deletingProfileId = profileId;
    this.repository.deleteProfile(profileId).pipe(
      finalize(() => this.deletingProfileId = null)
    ).subscribe({
      next: () => {
        this.profiles = this.profiles.filter(profile => profile.profileId !== profileId);
        this.pendingDeleteId = null;
        this.notifyService.success('Đã xóa hồ sơ thể thao.');
      },
      error: error => this.notifyService.error(this.getErrorMessage(error))
    });
  }

  sportLabel(sport: SportType | null): string {
    return this.sportOptions.find(option => option.value === sport)?.label ?? '';
  }

  sportIcon(sport: SportType | null): string {
    return CLUB_SPORTS.find(option => option.value === sport)?.icon ?? 'trophy';
  }

  skillLabel(skill: SkillLevel): string {
    return SKILL_LEVEL_OPTIONS.find(option => option.value === skill)?.label ?? skill;
  }

  dayLabel(day: PlayerDayOfWeek): string {
    return PLAYER_DAY_OPTIONS.find(option => option.value === day)?.label ?? day;
  }

  formatWinRate(winRate: number): string {
    const percent = winRate <= 1 ? winRate * 100 : winRate;
    return `${Math.round(percent)}%`;
  }

  private createEmptyDraft(): SportProfileDraft {
    return {
      sportType: this.sportOptions.find(option => !this.profiles.some(p => p.sportType === option.value))?.value ?? null,
      skillLevel: SkillLevel.INTERMEDIATE,
      skillLocked: false,
      eloRating: null,
      preferredPositions: '',
      playStyle: '',
      city: '',
      preciseLatitude: null,
      preciseLongitude: null,
      playRadiusKm: 10,
      availabilities: []
    };
  }

  private toPayload(): SavePlayerSportProfileRequest | null {
    if (!this.draft.sportType) {
      this.notifyService.error('Vui lòng chọn môn thể thao.');
      return null;
    }
    const province = this.provinceByName(this.draft.city);
    if (!province) {
      this.notifyService.error('Vui lòng chọn tỉnh/thành phố để hồ sơ xuất hiện trong scouting.');
      return null;
    }
    if (!this.validateAvailabilities()) return null;

    const positions = [...new Set(
      this.draft.preferredPositions
        .split(',')
        .map(position => position.trim())
        .filter(Boolean)
    )];
    if (positions.length > 10 || positions.some(position => position.length > 50)) {
      this.notifyService.error('Tối đa 10 vị trí yêu thích, mỗi vị trí không quá 50 ký tự.');
      return null;
    }

    return {
      sportType: this.draft.sportType,
      skillLevel: this.draft.skillLevel,
      preferredPositions: positions,
      playStyle: this.draft.playStyle.trim() || undefined,
      city: province.name,
      latitude: this.draft.preciseLatitude ?? province.latitude,
      longitude: this.draft.preciseLongitude ?? province.longitude,
      playRadiusKm: this.draft.playRadiusKm,
      availabilities: this.draft.availabilities.map(({ clientId: _clientId, ...slot }) => ({
        ...slot,
        timezone: slot.timezone.trim() || this.browserTimezone
      }))
    };
  }

  private validateAvailabilities(): boolean {
    for (const slot of this.draft.availabilities) {
      if (!slot.startTime || !slot.endTime || slot.startTime >= slot.endTime) {
        this.notifyService.error('Giờ bắt đầu của lịch rảnh phải sớm hơn giờ kết thúc.');
        return false;
      }
    }
    const activeSlots = this.draft.availabilities
      .filter(slot => slot.active)
      .sort((left, right) => left.dayOfWeek.localeCompare(right.dayOfWeek)
        || left.startTime.localeCompare(right.startTime));
    for (let index = 1; index < activeSlots.length; index++) {
      const previous = activeSlots[index - 1];
      const current = activeSlots[index];
      if (previous.dayOfWeek === current.dayOfWeek && current.startTime < previous.endTime) {
        this.notifyService.error('Các khung giờ rảnh trong cùng một ngày không được chồng nhau.');
        return false;
      }
    }
    return true;
  }

  private provinceByName(name: string): VietnamProvince | undefined {
    return this.locationData.provinces().find(province => province.name === name);
  }

  // ponytail: linear scan over 34 province centres; fine at this size, no spatial index needed.
  private nearestProvince(latitude: number, longitude: number): VietnamProvince | undefined {
    let best: VietnamProvince | undefined;
    let bestDistance = Infinity;
    const cosLat = Math.cos(latitude * Math.PI / 180);
    for (const province of this.locationData.provinces()) {
      const dLat = province.latitude - latitude;
      const dLng = (province.longitude - longitude) * cosLat;
      const distance = dLat * dLat + dLng * dLng;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = province;
      }
    }
    return best;
  }

  private toTimeInput(value: string): string {
    return value?.slice(0, 5) || '';
  }

  private sortProfiles(): void {
    const order = this.sportOptions.map(option => option.value);
    this.profiles = [...this.profiles].sort(
      (left, right) => order.indexOf(left.sportType) - order.indexOf(right.sportType)
    );
  }

  private get browserTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh';
  }

  private getErrorMessage(error: unknown): string {
    const message = (error as { error?: { message?: unknown } })?.error?.message;
    if (typeof message === 'string' && message.trim()) return message;
    if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
    return 'Không thể cập nhật hồ sơ thể thao. Vui lòng thử lại.';
  }
}
