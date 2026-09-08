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
  latitude?: number;
  longitude?: number;
  playRadiusKm?: number;
  winCount: number;
  lossCount: number;
  drawCount: number;
  matchCount: number;
  winRate: number;
  availabilities: PlayerAvailability[];
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
  latitude?: number;
  longitude?: number;
  playRadiusKm?: number;
  availabilities: SavePlayerAvailabilityRequest[];
}

export {
  PLAYER_DAY_OPTIONS,
  PlayerDayOfWeek,
  SKILL_LEVEL_OPTIONS,
  SkillLevel,
  SPORT_TYPE_OPTIONS,
  SportType
};
