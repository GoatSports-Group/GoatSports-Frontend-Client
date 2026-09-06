export interface TournamentModel {
  tournamentId: string;
  name: string;
  description?: string;
  bannerUrl?: string;
  sportType: string;
  format: 'SINGLE_ELIMINATION' | 'ROUND_ROBIN' | 'DOUBLE_ELIMINATION';
  status: 'DRAFT' | 'OPEN_REGISTRATION' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  organizerId: string;
  organizerName?: string;
  venueId?: string;
  venueName?: string;
  maxParticipants: number;
  currentParticipants: number;
  entryFee?: number;
  prizePool?: number;
  registrationOpenDate?: string;
  registrationCloseDate?: string;
  startDate?: string;
  endDate?: string;
  rules?: string;
  prizeInfo?: string;
}

export interface TournamentRegistrationModel {
  registrationId: string;
  tournamentId: string;
  playerId: string;
  playerName: string;
  playerPhone?: string;
  clubId?: string;
  clubName?: string;
  teamName: string;
  type: 'INDIVIDUAL' | 'CLUB_TEAM' | 'FREELANCE_TEAM';
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'DISQUALIFIED';
  athleteIdCode?: string;
  idNumber?: string;
  skillLevel?: string;
  registeredAt?: string;
  lineups?: TournamentLineupModel[];
}

export interface TournamentLineupModel {
  lineupId?: string;
  playerId: string;
  playerName: string;
  playerPhone?: string;
  lineupRole: 'CAPTAIN' | 'MAIN_PLAYER' | 'SUBSTITUTE' | 'COACH';
  isStarter: boolean;
}

export interface TournamentFixtureModel {
  fixtureId: string;
  tournamentId: string;
  roundName: string;
  roundNumber: number;
  matchNumber: number;
  registration1Id?: string;
  team1Name?: string;
  registration2Id?: string;
  team2Name?: string;
  score1?: number;
  score2?: number;
  winnerRegistrationId?: string;
  scheduledTime?: string;
  courtName?: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

export interface TournamentStandingModel {
  registrationId: string;
  teamName: string;
  matchesPlayed: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  scoreFor: number;
  scoreAgainst: number;
  scoreDifference: number;
}
