import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AIRecommendationRequest, AIRecommendationResult } from '../../domain/entities/recommendation';
import { GetRecommendationsUseCase } from '../../application/recommendation/get-recommendations.usecase';

@Injectable({
  providedIn: 'root'
})
export class RecommendationService {
  private getRecommendationsUseCase = inject(GetRecommendationsUseCase);

  getRecommendations(request: AIRecommendationRequest): Observable<AIRecommendationResult[]> {
    return this.getRecommendationsUseCase.execute(request);
  }
}
