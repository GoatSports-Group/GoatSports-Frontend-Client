import { Observable } from 'rxjs';
import { PageResult } from '@application/dto/base/base-response';
import {
  FeeCheckoutModel,
  MyTournamentRole,
  TeamInvitationModel,
  TeamInvitee,
  TournamentFixtureModel,
  TournamentModel,
  TournamentRegistrationModel,
  TournamentRegistrationPayload,
  TournamentEligibilityRuleModel,
  TournamentReservationModel,
  TournamentSearchFilter,
  TournamentStandingModel
} from '@domain/models/tournament.model';

/** Phia nguoi choi. Tao va dieu hanh giai nam o khu chu san (goat-sports-admin). */
export abstract class TournamentRepositoryPort {
  /** {@code page} 0-based; ban nhap khong bao gio xuat hien o day. */
  abstract searchTournaments(filter: TournamentSearchFilter, page: number, size: number): Observable<PageResult<TournamentModel>>;
  abstract getMyTournaments(role: MyTournamentRole, page: number, size: number): Observable<PageResult<TournamentModel>>;
  abstract getTournamentDetails(tournamentId: string): Observable<TournamentModel>;
  abstract registerTeam(tournamentId: string, payload: TournamentRegistrationPayload): Observable<TournamentRegistrationModel>;
  /** Nguoi dang ky tu rut; da dong phi thi he thong tu gui yeu cau hoan. */
  abstract cancelRegistration(tournamentId: string, registrationId: string): Observable<void>;
  abstract getMyInvitations(): Observable<TeamInvitationModel[]>;
  abstract respondInvitation(tournamentId: string, registrationId: string, accept: boolean): Observable<TournamentRegistrationModel>;
  abstract inviteMembers(tournamentId: string, registrationId: string, members: TeamInvitee[]): Observable<TournamentRegistrationModel>;
  /** Doi truong bo mot nguoi, hoac chinh minh roi doi (playerId = toi). */
  abstract removeMember(tournamentId: string, registrationId: string, playerId: string): Observable<TournamentRegistrationModel>;
  abstract checkout(tournamentId: string, registrationId: string): Observable<FeeCheckoutModel>;
  abstract getTournamentTeams(tournamentId: string): Observable<TournamentRegistrationModel[]>;
  abstract getFixtures(tournamentId: string): Observable<TournamentFixtureModel[]>;
  abstract getStandings(tournamentId: string): Observable<TournamentStandingModel[]>;
  abstract getEligibilityRules(tournamentId: string): Observable<TournamentEligibilityRuleModel[]>;
  abstract getReservations(tournamentId: string): Observable<TournamentReservationModel[]>;
}
