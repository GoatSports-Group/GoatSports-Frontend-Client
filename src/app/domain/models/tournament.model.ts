import { SportType } from './club.model';

export type TournamentFormat = 'SINGLE_ELIMINATION' | 'ROUND_ROBIN';
export type TournamentStatus = 'DRAFT' | 'PUBLISHED' | 'REGISTRATION_OPEN' | 'REGISTRATION_CLOSED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
/** CLUB la kieu cu (nay backend doi thanh TEAM dai dien CLB). */
export type RegistrationType = 'INDIVIDUAL' | 'TEAM' | 'CLUB';
export type RegistrationStatus =
  | 'PENDING_MEMBERS' | 'PENDING_ELIGIBILITY' | 'PENDING_PAYMENT' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';
export type FeePaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'WAIVED' | 'REFUND_REQUESTED';
export type ParticipantType = 'INDIVIDUAL' | 'TEAM';
export type LineupMemberStatus = 'INVITED' | 'ACCEPTED' | 'DECLINED';
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
  /** Co so + cac san chu san giu cho ca thoi gian giai, trong khung gio moi ngay. */
  venueId?: string;
  courtIds?: string[];
  dailyStartTime?: string;
  dailyEndTime?: string;
  matchDurationMinutes?: number;
  /** Noi dung thi dau (don, doi, 5 nguoi...) quyet dinh dang ky ca nhan hay theo doi. */
  playFormat?: string;
  playFormatLabel?: string;
  participantType?: ParticipantType;
  rosterMin?: number;
  rosterMax?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TournamentSearchFilter {
  sportType?: SportType;
  status?: TournamentStatus;
  keyword?: string;
  /** Spring sort, mac dinh 'startDate,desc'. */
  sort?: string;
}

/** ORGANIZING: giai toi to chuc; PARTICIPATING: giai toi co ten trong mot dang ky. */
export type MyTournamentRole = 'ORGANIZING' | 'PARTICIPATING';

export interface TournamentRegistrationPayload {
  playerId?: string;
  clubId?: string;
  teamName?: string;
  type: RegistrationType;
  skillLevel?: SkillLevel;
  captainShirtNumber?: number;
  /** Doi: nhung nguoi duoc moi (khong gom doi truong); moi nguoi phai tu nhan loi. */
  lineups?: TeamInvitee[];
}

export interface TeamInvitee {
  playerId: string;
  playerName: string;
  lineupRole: LineupRole;
  shirtNumber?: number;
}

export interface TournamentRegistrationModel extends TournamentRegistrationPayload {
  registrationId: string;
  tournamentId: string;
  registeredBy: string;
  status: RegistrationStatus;
  statusReason?: string;
  registeredAt: string;
  confirmedAt?: string;
  /** Han dong le phi (24 gio tu khi du dieu kien); qua han suat tu tra lai. */
  paymentDeadline?: string;
  paymentStatus?: FeePaymentStatus;
  feeAmount?: number;
  lineups: TournamentLineupModel[];
}

export interface TournamentLineupModel {
  lineupId: string;
  playerId: string;
  playerName: string;
  lineupRole: LineupRole;
  shirtNumber?: number;
  memberStatus?: LineupMemberStatus;
  respondedAt?: string;
}

/** Loi moi vao doi dang cho toi tra loi. */
export interface TeamInvitationModel {
  tournamentId: string;
  tournamentName: string;
  sportType: SportType;
  startDate: string;
  registrationCloseDate: string;
  registrationId: string;
  teamName?: string;
  captainId: string;
  clubId?: string;
  lineupRole: LineupRole;
  shirtNumber?: number;
  acceptedCount: number;
  rosterMin: number;
  rosterMax: number;
}

/** Ma thanh toan le phi do club-service tao; so tien do server tinh. */
export interface FeeCheckoutModel {
  paymentId: string;
  checkoutUrl?: string;
  qrCodeContent?: string;
  amount: number;
  expiresAt?: string;
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

export type EligibilityRuleType =
  | 'AGE' | 'GENDER' | 'SKILL_LEVEL' | 'ELO_RATING' | 'CLUB_MEMBERSHIP' | 'TEAM_SIZE';

export type EligibilityRuleOperator =
  | 'EQUAL' | 'NOT_EQUAL' | 'GREATER_THAN' | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN' | 'LESS_THAN_OR_EQUAL' | 'IN' | 'BETWEEN';

export interface TournamentEligibilityRuleModel {
  ruleId: string;
  tournamentId: string;
  ruleType: EligibilityRuleType;
  operator: EligibilityRuleOperator;
  expectedValue: string;
}

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'RELEASED' | 'CANCELLED';

export interface TournamentReservationModel {
  reservationId: string;
  tournamentId: string;
  venueId: string;
  courtId: string;
  bookingId: string | null;
  playDate: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
}
