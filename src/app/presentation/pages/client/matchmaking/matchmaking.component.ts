import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AiRepositoryPort } from '@application/ports/ai.repository.port';
import { MatchmakingSession } from '@application/dto/matchmaking/matchmaking.dto';
import { AuthService } from '@presentation/services/auth.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-matchmaking',
  templateUrl: './matchmaking.component.html',
  styleUrls: ['./matchmaking.component.scss'],
  standalone: false
})
export class MatchmakingComponent implements OnInit, OnDestroy {
  selectedSport = 'BADMINTON';
  selectedSkill = 'INTERMEDIATE';
  maxDistance = 10;
  isSearching = false;
  matchedSession: MatchmakingSession | null = null;
  searchTimer: any;
  elapsedSeconds = 0;
  pollSub?: Subscription;

  sports = [
    { label: 'Cầu lông', value: 'BADMINTON', icon: 'pi pi-bolt' },
    { label: 'Pickleball', value: 'PICKLEBALL', icon: 'pi pi-star' },
    { label: 'Tennis', value: 'TENNIS', icon: 'pi pi-sun' },
    { label: 'Bóng đá', value: 'FOOTBALL', icon: 'pi pi-circle' }
  ];

  skills = [
    { label: 'Mới chơi / Nhập môn', value: 'BEGINNER' },
    { label: 'Trung bình / Phong trào', value: 'INTERMEDIATE' },
    { label: 'Khá / Bán chuyên', value: 'ADVANCED' },
    { label: 'Chuyên nghiệp / Thi đấu', value: 'PRO' }
  ];

  constructor(
    private readonly aiRepo: AiRepositoryPort,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.cancelSearch();
  }

  startMatchmaking(): void {
    const user = this.authService.currentUser;
    if (!user) {
      this.authService.redirectToLogin();
      return;
    }

    this.isSearching = true;
    this.matchedSession = null;
    this.elapsedSeconds = 0;

    this.searchTimer = setInterval(() => {
      this.elapsedSeconds++;
    }, 1000);

    // Call AI service
    this.aiRepo.joinMatchmakingQueue({
      playerId: user.userId,
      playerName: user.fullName || user.email,
      playerAvatar: user.avatarUrl,
      sport: this.selectedSport,
      skillLevel: this.selectedSkill,
      eloRating: 1350,
      locationLat: 10.8231,
      locationLng: 106.6297,
      maxDistanceKm: this.maxDistance
    }).subscribe({
      next: (res) => {
        if (res.status === 'MATCHED' && res.session) {
          this.handleMatchFound(res.session);
        } else {
          this.startPolling(user.userId);
        }
      },
      error: () => {
        this.cancelSearch();
      }
    });
  }

  startPolling(playerId: string): void {
    this.pollSub = interval(3000).subscribe(() => {
      this.aiRepo.checkMatchmakingStatus(playerId).subscribe({
        next: (res) => {
          if (res.status === 'MATCHED' && res.session) {
            this.handleMatchFound(res.session);
          }
        }
      });
    });
  }

  handleMatchFound(session: MatchmakingSession): void {
    this.isSearching = false;
    clearInterval(this.searchTimer);
    this.pollSub?.unsubscribe();
    this.matchedSession = session;
  }

  cancelSearch(): void {
    const user = this.authService.currentUser;
    if (user && this.isSearching) {
      this.aiRepo.leaveMatchmakingQueue(user.userId).subscribe();
    }
    this.isSearching = false;
    clearInterval(this.searchTimer);
    this.pollSub?.unsubscribe();
  }

  openChat(): void {
    this.router.navigate(['/chat']);
  }
}
