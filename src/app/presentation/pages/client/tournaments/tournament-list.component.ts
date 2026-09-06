import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import { Tournament } from '@application/dto/tournament/tournament.dto';
import { AuthService } from '@presentation/services/auth.service';

@Component({
  selector: 'app-tournament-list',
  templateUrl: './tournament-list.component.html',
  styleUrls: ['./tournament-list.component.scss'],
  standalone: false
})
export class TournamentListComponent implements OnInit {
  tournaments: Tournament[] = [];
  loading = false;
  selectedSport = 'ALL';
  searchKeyword = '';
  showCreateModal = false;

  newTournament: Partial<Tournament> = {
    name: '',
    sportType: 'BADMINTON',
    format: 'SINGLE_ELIMINATION',
    description: '',
    maxParticipants: 16,
    entryFee: 100000,
    prizePool: 2000000
  };


  sports = [
    { label: 'Tất cả', value: 'ALL' },
    { label: 'Cầu lông', value: 'BADMINTON' },
    { label: 'Bóng đá', value: 'FOOTBALL' },
    { label: 'Pickleball', value: 'PICKLEBALL' },
    { label: 'Tennis', value: 'TENNIS' }
  ];

  constructor(
    private readonly tournamentRepo: TournamentRepositoryPort,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadTournaments();
  }

  loadTournaments(): void {
    this.loading = true;
    const sport = this.selectedSport === 'ALL' ? undefined : this.selectedSport;
    this.tournamentRepo.searchTournaments(sport, undefined, this.searchKeyword).subscribe({
      next: (res) => {
        this.tournaments = res || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  selectSport(sport: string): void {
    this.selectedSport = sport;
    this.loadTournaments();
  }

  goToDetail(id: string): void {
    this.router.navigate(['/tournaments', id]);
  }

  createTournament(): void {
    const user = this.authService.currentUser;
    if (!user) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.newTournament.organizerId = user.userId;
    this.newTournament.organizerName = user.fullName || user.email;

    this.tournamentRepo.createTournament(this.newTournament).subscribe({
      next: (res) => {
        this.showCreateModal = false;
        this.loadTournaments();
        this.router.navigate(['/tournaments', res.tournamentId]);
      }
    });
  }

}
