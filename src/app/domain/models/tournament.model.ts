import { SportType } from './club.model';

export type TournamentFormat = 'SINGLE_ELIMINATION' | 'ROUND_ROBIN';
export type TournamentStatus = 'DRAFT' | 'PUBLISHED' | 'REGISTRATION_OPEN' | 'REGISTRATION_CLOSED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type RegistrationType = 'INDIVIDUAL' | 'CLUB';
export type RegistrationStatus = 'PENDING_ELIGIBILITY' | 'PENDING_PAYMENT' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';
export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'PRO';
export type LineupRole = 'CAPTAIN' | 'PLAYER' | 'SUBSTITUTE';

export interface TournamentModel {
  tournamentId: string;
  organizerId: string;
  name: string;
  description?: string;
  sportType: SportType;
  format: TournamentFormat;
  status: TournamentStatus;
  maxParticipants: number;
  currentParticipants: number;
  entryFee: number;
  prizePool: number;
  registrationOpenDate: string;
  registrationCloseDate: string;
  startDate: string;
  endDate: string;
  rules: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTournamentPayload {
  name: string;
  description?: string;
  sportType: SportType;
  format: TournamentFormat;
  maxParticipants: number;
  entryFee: number;
  prizePool: number;
  registrationOpenDate: string;
  registrationCloseDate: string;
  startDate: string;
  endDate: string;
  rules: string[];
}

export interface TournamentRegistrationPayload {
  playerId?: string;
  clubId?: string;
  teamName?: string;
  type: RegistrationType;
  skillLevel?: SkillLevel;
  lineups?: Array<{
    playerId: string;
    playerName: string;
    lineupRole: LineupRole;
    shirtNumber?: number;
  }>;
}

export interface TournamentRegistrationModel extends TournamentRegistrationPayload {
  registrationId: string;
  tournamentId: string;
  registeredBy: string;
  status: RegistrationStatus;
  statusReason?: string;
  registeredAt: string;
  confirmedAt?: string;
  lineups: TournamentLineupModel[];
}

export interface TournamentLineupModel {
  lineupId: string;
  playerId: string;
  playerName: string;
  lineupRole: LineupRole;
  shirtNumber?: number;
}

export interface TournamentFixtureModel {
  fixtureId: string;
  tournamentId: string;
  roundName: string;
  roundNumber: number;
  matchNumber: number;
  registration1Id?: string;
  registration2Id?: string;
  score1?: number;
  score2?: number;
  winnerRegistrationId?: string;
  nextFixtureId?: string;
  reservationId?: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

export interface TournamentStandingModel {
  standingId?: string;
  tournamentId: string;
  registrationId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scoreFor: number;
  scoreAgainst: number;
  points: number;
  rank: number;
}
