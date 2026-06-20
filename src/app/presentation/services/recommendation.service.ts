import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AIRecommendationRequest, AIRecommendationResult } from '@application/dto/recommendation/recommendation.dto';
import { GetRecommendationsUseCase } from '@application/usecase/recommendation/get-recommendations.usecase';

@Injectable({
  providedIn: 'root'
})
export class RecommendationService {
  private getRecommendationsUseCase = inject(GetRecommendationsUseCase);

  getRecommendations(request: AIRecommendationRequest): Observable<AIRecommendationResult[]> {
    return this.getRecommendationsUseCase.execute(request);
  }
}
