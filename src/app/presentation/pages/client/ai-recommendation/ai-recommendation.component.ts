import { Component, inject } from '@angular/core';
import { RecommendationService } from '../../../services/recommendation.service';
import { AIRecommendationRequest, AIRecommendationResult } from '../../../../domain/entities/recommendation';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-ai-recommendation',
  templateUrl: './ai-recommendation.component.html',
  styleUrls: ['./ai-recommendation.component.scss']
})
export class AiRecommendationComponent {
  private recommendationService = inject(RecommendationService);
  private snackBar = inject(MatSnackBar);

  // Form fields
  location: string = '';
  budget: number = 200000;
  sportType: string = 'all';
  preferredDate: string = new Date().toISOString().split('T')[0];
  preferredTime: string = 'Evening';

  // State
  recommendations: AIRecommendationResult[] = [];
  loading = false;
  hasSearched = false;

  get minDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  recommend() {
    this.loading = true;
    this.hasSearched = true;
    this.recommendations = [];

    const request: AIRecommendationRequest = {
      location: this.location.trim(),
      budget: this.budget,
      sportType: this.sportType,
      preferredDate: this.preferredDate,
      preferredTime: this.preferredTime
    };

    this.recommendationService.getRecommendations(request).subscribe({
      next: (results) => {
        this.recommendations = results;
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Không thể kết nối với Trợ lý AI!', 'Đóng', {
          duration: 3000,
          panelClass: ['snackbar-error']
        });
        this.loading = false;
      }
    });
  }

  getSportTypeLabel(type: string): string {
    switch (type) {
      case 'soccer': return 'Bóng đá';
      case 'badminton': return 'Cầu lông';
      case 'tennis': return 'Tennis';
      case 'pickleball': return 'Pickleball';
      case 'basketball': return 'Bóng rổ';
      case 'volleyball': return 'Bóng chuyền';
      default: return type;
    }
  }

  getScoreColorClass(score: number): string {
    if (score >= 90) return 'score-high';
    if (score >= 75) return 'score-medium';
    return 'score-low';
  }
}
