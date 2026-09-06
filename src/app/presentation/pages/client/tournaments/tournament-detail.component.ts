import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import {
  Tournament,
  TournamentRegistration,
  TournamentFixture,
  TournamentStanding
} from '@application/dto/tournament/tournament.dto';
import { AuthService } from '@presentation/services/auth.service';

@Component({
  selector: 'app-tournament-detail',
  templateUrl: './tournament-detail.component.html',
  styleUrls: ['./tournament-detail.component.scss'],
  standalone: false
})
export class TournamentDetailComponent implements OnInit {
  tournamentId = '';
  tournament: Tournament | null = null;
  teams: TournamentRegistration[] = [];
  fixtures: TournamentFixture[] = [];
  standings: TournamentStanding[] = [];
  activeTab: 'BRACKET' | 'FIXTURES' | 'STANDINGS' | 'TEAMS' = 'BRACKET';
  loading = false;
  isOrganizer = false;
  showRegisterModal = false;
  showScoreModal = false;
  selectedFixture: TournamentFixture | null = null;


  score1 = 0;
  score2 = 0;

  regForm: any = {
    teamName: '',
    athleteIdCode: '',
    idNumber: '',
    skillLevel: 'INTERMEDIATE'
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly tournamentRepo: TournamentRepositoryPort,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.tournamentId = this.route.snapshot.paramMap.get('id') || '';
    if (this.tournamentId) {
      this.loadDetails();
      this.loadTeams();
      this.loadFixtures();
      this.loadStandings();
    }
  }

  loadDetails(): void {
    this.loading = true;
    this.tournamentRepo.getTournamentDetails(this.tournamentId).subscribe({
      next: (res: any) => {
        this.tournament = res;
        this.loading = false;
        const user = this.authService.currentUser;
        if (user && this.tournament) {
          this.isOrganizer = (this.tournament.organizerId === user.userId);
        }
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadTeams(): void {
    this.tournamentRepo.getTournamentTeams(this.tournamentId).subscribe({
      next: (res: any) => {
        this.teams = res || [];
      }
    });
  }

  loadFixtures(): void {
    this.tournamentRepo.getFixtures(this.tournamentId).subscribe({
      next: (res: any) => {
        this.fixtures = res || [];
      }
    });
  }

  loadStandings(): void {
    this.tournamentRepo.getStandings(this.tournamentId).subscribe({
      next: (res: any) => {
        this.standings = res || [];
      }
    });
  }

  generateBracket(): void {
    const user = this.authService.currentUser;
    if (!user) return;

    this.tournamentRepo.generateFixtures(this.tournamentId, user.userId).subscribe({
      next: (res: any) => {
        this.fixtures = res || [];
        this.activeTab = 'BRACKET';
      }
    });
  }

  registerTeam(): void {
    const user = this.authService.currentUser;
    if (!user) {
      this.authService.redirectToLogin();
      return;
    }

    this.tournamentRepo.registerTeam(this.tournamentId, {
      ...this.regForm,
      playerId: user.userId,
      playerName: user.fullName || user.email,
      teamName: this.regForm.teamName || user.fullName || user.email
    } as any).subscribe({
      next: () => {
        this.showRegisterModal = false;
        this.loadDetails();
        this.loadTeams();
      }
    });
  }

  openScoreModal(fixture: TournamentFixture): void {
    if (!this.isOrganizer) return;
    this.selectedFixture = fixture;
    this.score1 = fixture.score1 || 0;
    this.score2 = fixture.score2 || 0;
    this.showScoreModal = true;
  }


  saveScore(): void {
    const user = this.authService.currentUser;
    if (!user || !this.selectedFixture) return;

    this.tournamentRepo.updateFixtureResult(
      this.tournamentId,
      this.selectedFixture.fixtureId,
      {
        score1: this.score1,
        score2: this.score2,
        actorUserId: user.userId
      }
    ).subscribe({
      next: () => {
        this.showScoreModal = false;
        this.loadFixtures();
        this.loadStandings();
      }
    });
  }
}
