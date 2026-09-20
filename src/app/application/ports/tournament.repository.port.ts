import { Observable } from 'rxjs';
import { SportType } from '@domain/models/club.model';
import {
  CreateTournamentPayload,
  TournamentFixtureModel,
  TournamentModel,
  TournamentRegistrationModel,
  TournamentRegistrationPayload,
  TournamentEligibilityRuleModel,
  TournamentReservationModel,
  TournamentStandingModel,
  TournamentStatus,
  ReserveVenuePayload
} from '@domain/models/tournament.model';

export abstract class TournamentRepositoryPort {
  abstract searchTournaments(sportType?: SportType, status?: TournamentStatus, keyword?: string): Observable<TournamentModel[]>;
  abstract getTournamentDetails(tournamentId: string): Observable<TournamentModel>;
  abstract createTournament(payload: CreateTournamentPayload): Observable<TournamentModel>;
  abstract registerTeam(tournamentId: string, payload: TournamentRegistrationPayload): Observable<TournamentRegistrationModel>;
  abstract cancelRegistration(tournamentId: string, registrationId: string): Observable<void>;
  abstract getTournamentTeams(tournamentId: string): Observable<TournamentRegistrationModel[]>;
  abstract getFixtures(tournamentId: string): Observable<TournamentFixtureModel[]>;
  abstract generateFixtures(tournamentId: string): Observable<TournamentFixtureModel[]>;
  abstract updateFixtureResult(tournamentId: string, fixtureId: string,
    payload: { score1: number; score2: number }): Observable<TournamentFixtureModel>;
  abstract getStandings(tournamentId: string): Observable<TournamentStandingModel[]>;
  abstract getEligibilityRules(tournamentId: string): Observable<TournamentEligibilityRuleModel[]>;
  abstract changeStatus(tournamentId: string, status: TournamentStatus): Observable<TournamentModel>;
  abstract getReservations(tournamentId: string): Observable<TournamentReservationModel[]>;
  abstract reserveVenue(tournamentId: string, payload: ReserveVenuePayload): Observable<TournamentReservationModel>;
  abstract releaseReservation(tournamentId: string, reservationId: string): Observable<void>;
}
