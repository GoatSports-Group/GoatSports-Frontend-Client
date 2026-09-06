import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { Club } from '@application/dto/club/club.dto';
import { AuthService } from '@presentation/services/auth.service';

@Component({
  selector: 'app-club-list',
  templateUrl: './club-list.component.html',
  styleUrls: ['./club-list.component.scss'],
  standalone: false
})
export class ClubListComponent implements OnInit {
  clubs: Club[] = [];
  loading = false;
  selectedSport = 'ALL';
  searchKeyword = '';
  showCreateModal = false;

  newClub: Partial<Club> = {
    name: '',
    sportType: 'BADMINTON',
    description: '',
    region: 'TP. Hồ Chí Minh',
    privacy: 'PUBLIC',
    approvalMode: 'AUTO',
    maxMembers: 50
  };

  sports = [
    { label: 'Tất cả', value: 'ALL', icon: 'pi pi-globe' },
    { label: 'Cầu lông', value: 'BADMINTON', icon: 'pi pi-bolt' },
    { label: 'Pickleball', value: 'PICKLEBALL', icon: 'pi pi-star' },
    { label: 'Tennis', value: 'TENNIS', icon: 'pi pi-sun' },
    { label: 'Bóng đá', value: 'FOOTBALL', icon: 'pi pi-circle' }
  ];

  constructor(
    private readonly clubRepo: ClubRepositoryPort,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadClubs();
  }

  loadClubs(): void {
    this.loading = true;
    const sport = this.selectedSport === 'ALL' ? undefined : this.selectedSport;
    this.clubRepo.searchClubs(sport, this.searchKeyword).subscribe({
      next: (res) => {
        this.clubs = res || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onSportSelect(sport: string): void {
    this.selectedSport = sport;
    this.loadClubs();
  }

  selectSport(sport: string): void {
    this.onSportSelect(sport);
  }

  onSearch(): void {
    this.loadClubs();
  }


  goToDetail(clubId: string): void {
    this.router.navigate(['/clubs', clubId]);
  }

  openCreateModal(): void {
    if (!this.authService.currentUser) {
      this.router.navigate(['/auth/login']);
      return;
    }
    this.showCreateModal = true;
  }

  createClub(): void {
    const user = this.authService.currentUser;
    if (!user) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.newClub.ownerId = user.userId;
    this.newClub.ownerName = user.fullName || user.email;

    this.clubRepo.createClub(this.newClub).subscribe({
      next: (res) => {
        this.showCreateModal = false;
        this.loadClubs();
        this.router.navigate(['/clubs', res.clubId]);
      }
    });
  }

}
