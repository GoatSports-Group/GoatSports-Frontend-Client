import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { Club, ClubMember, ClubActivity } from '@application/dto/club/club.dto';

import { AuthService } from '@presentation/services/auth.service';

@Component({
  selector: 'app-club-detail',
  templateUrl: './club-detail.component.html',
  styleUrls: ['./club-detail.component.scss'],
  standalone: false
})
export class ClubDetailComponent implements OnInit {
  clubId = '';
  club: Club | null = null;
  members: ClubMember[] = [];
  activities: ClubActivity[] = [];
  activeTab: 'OVERVIEW' | 'MEMBERS' | 'ACTIVITIES' = 'OVERVIEW';
  loading = false;
  isMember = false;
  isOwner = false;
  showActivityModal = false;

  newActivity: Partial<ClubActivity> = {
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    maxParticipants: 12
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly clubRepo: ClubRepositoryPort,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.clubId = this.route.snapshot.paramMap.get('id') || '';
    if (this.clubId) {
      this.loadDetails();
      this.loadMembers();
      this.loadActivities();
    }
  }

  loadDetails(): void {
    this.loading = true;
    this.clubRepo.getClubDetails(this.clubId).subscribe({
      next: (res) => {
        this.club = res;
        this.loading = false;
        const user = this.authService.currentUser;
        if (user && this.club) {
          this.isOwner = (this.club.ownerId === user.userId);
        }
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadMembers(): void {
    this.clubRepo.getClubMembers(this.clubId).subscribe({
      next: (res) => {
        this.members = res || [];
        const user = this.authService.currentUser;
        if (user) {
          this.isMember = this.members.some(m => m.userId === user.userId && m.status === 'ACCEPTED');
        }
      }
    });
  }

  loadActivities(): void {
    this.clubRepo.getClubActivities(this.clubId).subscribe({
      next: (res) => {
        this.activities = res || [];
      }
    });
  }

  joinClub(): void {
    const user = this.authService.currentUser;
    if (!user) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.clubRepo.joinClub(this.clubId, {
      userId: user.userId,
      userName: user.fullName || user.email,
      userAvatar: user.avatarUrl,
      introMessage: 'Xin chào mọi người!'
    }).subscribe({
      next: () => {
        this.loadDetails();
        this.loadMembers();
      }
    });
  }

  leaveClub(): void {
    const user = this.authService.currentUser;
    if (!user) return;

    this.clubRepo.leaveClub(this.clubId, user.userId).subscribe({
      next: () => {
        this.isMember = false;
        this.loadDetails();
        this.loadMembers();
      }
    });
  }

  createActivity(): void {
    const user = this.authService.currentUser;
    if (!user) return;

    this.clubRepo.createClubActivity(this.clubId, {
      ...this.newActivity,
      creatorId: user.userId
    } as any).subscribe({
      next: () => {
        this.showActivityModal = false;
        this.loadActivities();
      }
    });
  }
}

