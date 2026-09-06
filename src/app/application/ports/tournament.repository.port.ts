import { Observable } from 'rxjs';
import { TournamentModel, TournamentRegistrationModel, TournamentFixtureModel, TournamentStandingModel } from '@domain/models/tournament.model';

export abstract class TournamentRepositoryPort {
  abstract searchTournaments(sportType?: string, status?: string, keyword?: string): Observable<TournamentModel[]>;
  abstract getTournamentDetails(tournamentId: string): Observable<TournamentModel>;
  abstract createTournament(data: Partial<TournamentModel>): Observable<TournamentModel>;
  abstract registerTeam(tournamentId: string, payload: Partial<TournamentRegistrationModel>): Observable<TournamentRegistrationModel>;
  abstract getTournamentTeams(tournamentId: string): Observable<TournamentRegistrationModel[]>;
  abstract getFixtures(tournamentId: string): Observable<TournamentFixtureModel[]>;
  abstract generateFixtures(tournamentId: string, actorUserId: string): Observable<TournamentFixtureModel[]>;
  abstract updateFixtureResult(tournamentId: string, fixtureId: string, payload: { actorUserId: string; score1: number; score2: number }): Observable<TournamentFixtureModel>;
  abstract getStandings(tournamentId: string): Observable<TournamentStandingModel[]>;
}
