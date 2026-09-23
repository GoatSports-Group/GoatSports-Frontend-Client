import { PLAYER_DAY_OPTIONS, PlayerDayOfWeek } from '@domain/enums/player-day-of-week.enum';
import { SKILL_LEVEL_OPTIONS, SkillLevel } from '@domain/enums/skill-level.enum';
import { SPORT_TYPE_OPTIONS, SportType } from '@domain/enums/sport-type.enum';

export interface PlayerAvailability {
  availabilityId: string;
  dayOfWeek: PlayerDayOfWeek;
  startTime: string;
  endTime: string;
  timezone: string;
  active: boolean;
}

export interface PlayerSportProfile {
  profileId: string;
  sportType: SportType;
  skillLevel: SkillLevel;
  eloRating: number;
  preferredPositions: string[];
  playStyle?: string;
  /** Tỉnh/thành hồ sơ hiển thị cho scouting (tên theo vietnam-provinces.json). Hồ sơ cũ có thể chưa có. */
  city?: string;
  latitude?: number;
  longitude?: number;
  playRadiusKm?: number;
  winCount: number;
  lossCount: number;
  drawCount: number;
  matchCount: number;
  winRate: number;
  availabilities: PlayerAvailability[];
  /** Câu lạc bộ tìm thấy hồ sơ này khi tuyển thành viên (mặc định bật). */
  discoverable?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavePlayerAvailabilityRequest {
  availabilityId?: string;
  dayOfWeek: PlayerDayOfWeek;
  startTime: string;
  endTime: string;
  timezone: string;
  active: boolean;
}

export interface SavePlayerSportProfileRequest {
  sportType: SportType;
  skillLevel: SkillLevel;
  preferredPositions: string[];
  playStyle?: string;
  city: string;
  latitude: number;
  longitude: number;
  playRadiusKm?: number;
  availabilities: SavePlayerAvailabilityRequest[];
  discoverable: boolean;
}

export {
  PLAYER_DAY_OPTIONS,
  PlayerDayOfWeek,
  SKILL_LEVEL_OPTIONS,
  SkillLevel,
  SPORT_TYPE_OPTIONS,
  SportType
};
