import { Component, OnInit, inject } from '@angular/core';
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
import { NotifyService } from '@shared/components/notify/notify.service';

interface AvailabilityDraft extends SavePlayerAvailabilityRequest {
  clientId: number;
}

interface SportProfileDraft {
  sportType: SportType;
  skillLevel: SkillLevel;
  preferredPositions: string;
  playStyle: string;
  latitude: number | null;
  longitude: number | null;
  playRadiusKm: number | null;
  availabilities: AvailabilityDraft[];
}

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
  private nextClientId = 1;

  readonly sportOptions = SPORT_TYPE_OPTIONS;
  readonly skillOptions = SKILL_LEVEL_OPTIONS;
  readonly dayOptions = PLAYER_DAY_OPTIONS;

  profiles: PlayerSportProfile[] = [];
  isLoading = true;
  loadFailed = false;
  isEditorOpen = false;
  isSaving = false;
  isLocating = false;
  editingProfileId: string | null = null;
  pendingDeleteId: string | null = null;
  deletingProfileId: string | null = null;
  draft = this.createEmptyDraft();

  ngOnInit(): void {
    this.loadProfiles();
  }

  loadProfiles(): void {
    this.isLoading = true;
    this.loadFailed = false;
    this.repository.getMyProfiles().pipe(
      finalize(() => this.isLoading = false)
    ).subscribe({
      next: profiles => this.profiles = profiles,
      error: () => this.loadFailed = true
    });
  }

  openCreate(): void {
    const usedSports = new Set(this.profiles.map(profile => profile.sportType));
    const availableSport = this.sportOptions.find(option => !usedSports.has(option.value));
    if (!availableSport) {
      this.notifyService.warning('Bạn đã tạo hồ sơ cho tất cả môn thể thao được hỗ trợ.');
      return;
    }
    this.editingProfileId = null;
    this.draft = this.createEmptyDraft(availableSport.value);
    this.isEditorOpen = true;
  }

  openEdit(profile: PlayerSportProfile): void {
    this.editingProfileId = profile.profileId;
    this.draft = {
      sportType: profile.sportType,
      skillLevel: profile.skillLevel,
      preferredPositions: profile.preferredPositions.join(', '),
      playStyle: profile.playStyle || '',
      latitude: profile.latitude ?? null,
      longitude: profile.longitude ?? null,
      playRadiusKm: profile.playRadiusKm ?? null,
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
        this.draft.latitude = Number(position.coords.latitude.toFixed(6));
        this.draft.longitude = Number(position.coords.longitude.toFixed(6));
        this.notifyService.success('Đã cập nhật vị trí chơi ưu tiên.');
      },
      () => {
        this.isLocating = false;
        this.notifyService.error('Không thể lấy vị trí. Vui lòng cấp quyền vị trí hoặc nhập thủ công.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  clearLocation(): void {
    this.draft.latitude = null;
    this.draft.longitude = null;
  }

  saveProfile(): void {
    if (this.isSaving) return;
    const payload = this.toPayload();
    if (!payload) return;

    this.isSaving = true;
    const request = this.editingProfileId
      ? this.repository.updateProfile(this.editingProfileId, payload)
      : this.repository.createProfile(payload);
    request.pipe(finalize(() => this.isSaving = false)).subscribe({
      next: saved => {
        const currentIndex = this.profiles.findIndex(profile => profile.profileId === saved.profileId);
        if (currentIndex >= 0) {
          this.profiles = this.profiles.map(profile =>
            profile.profileId === saved.profileId ? saved : profile
          );
        } else {
          this.profiles = [...this.profiles, saved];
        }
        this.sortProfiles();
        this.isEditorOpen = false;
        this.editingProfileId = null;
        this.notifyService.success('Đã lưu hồ sơ thể thao và lịch rảnh.');
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

  isSportUnavailable(sport: SportType): boolean {
    return this.profiles.some(profile =>
      profile.sportType === sport && profile.profileId !== this.editingProfileId
    );
  }

  sportLabel(sport: SportType): string {
    return this.sportOptions.find(option => option.value === sport)?.label ?? sport;
  }

  skillLabel(skill: SkillLevel): string {
    return this.skillOptions.find(option => option.value === skill)?.label ?? skill;
  }

  dayLabel(day: PlayerDayOfWeek): string {
    return this.dayOptions.find(option => option.value === day)?.label ?? day;
  }

  formatWinRate(winRate: number): string {
    const percent = winRate <= 1 ? winRate * 100 : winRate;
    return `${Math.round(percent)}%`;
  }

  private createEmptyDraft(sportType: SportType = SportType.BADMINTON): SportProfileDraft {
    return {
      sportType,
      skillLevel: SkillLevel.INTERMEDIATE,
      preferredPositions: '',
      playStyle: '',
      latitude: null,
      longitude: null,
      playRadiusKm: 10,
      availabilities: []
    };
  }

  private toPayload(): SavePlayerSportProfileRequest | null {
    const latitude = this.numberOrUndefined(this.draft.latitude);
    const longitude = this.numberOrUndefined(this.draft.longitude);
    const radius = this.numberOrUndefined(this.draft.playRadiusKm);
    if ((latitude === undefined) !== (longitude === undefined)) {
      this.notifyService.error('Vui lòng nhập đầy đủ cả vĩ độ và kinh độ.');
      return null;
    }
    if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
      this.notifyService.error('Vĩ độ phải nằm trong khoảng từ -90 đến 90.');
      return null;
    }
    if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
      this.notifyService.error('Kinh độ phải nằm trong khoảng từ -180 đến 180.');
      return null;
    }
    if (radius !== undefined && (radius <= 0 || radius > 200)) {
      this.notifyService.error('Bán kính chơi phải lớn hơn 0 và không vượt quá 200 km.');
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
      latitude,
      longitude,
      playRadiusKm: radius,
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

  private numberOrUndefined(value: number | null): number | undefined {
    return value === null || !Number.isFinite(Number(value)) ? undefined : Number(value);
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
