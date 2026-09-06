import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AiRepositoryPort } from '@application/ports/ai.repository.port';
import { MatchmakingSessionModel, VenueRecommendationModel, ChatbotResponseModel } from '@domain/models/matchmaking.model';
import { environment } from '@environments/environment';


@Injectable({
  providedIn: 'root'
})
export class AiRepository extends AiRepositoryPort {
  private readonly baseUrl = `${environment.apiUrl || 'http://localhost:8080'}/api/v1/ai`;

  constructor(private readonly http: HttpClient) {
    super();
  }

  override joinMatchmakingQueue(payload: any): Observable<{ status: string; message: string; session?: MatchmakingSessionModel }> {
    return this.http.post<any>(`${this.baseUrl}/matchmaking/queue`, payload);
  }

  override checkMatchmakingStatus(playerId: string): Observable<{ status: string; queue_size?: number; session?: MatchmakingSessionModel }> {
    return this.http.get<any>(`${this.baseUrl}/matchmaking/status/${playerId}`);
  }

  override leaveMatchmakingQueue(playerId: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<any>(`${this.baseUrl}/matchmaking/queue/${playerId}`);
  }

  override getVenueRecommendations(lat?: number, lng?: number, sport?: string): Observable<VenueRecommendationModel[]> {
    let params = new HttpParams();
    if (lat) params = params.set('user_lat', lat.toString());
    if (lng) params = params.set('user_lng', lng.toString());
    if (sport) params = params.set('sport_type', sport);

    return this.http.get<VenueRecommendationModel[]>(`${this.baseUrl}/recommendations/venues`, { params });
  }

  override queryChatbot(message: string, lat?: number, lng?: number, sport?: string): Observable<ChatbotResponseModel> {
    const payload = {
      message,
      user_location_lat: lat,
      user_location_lng: lng,
      favorite_sport: sport
    };
    return this.http.post<ChatbotResponseModel>(`${this.baseUrl}/chatbot/query`, payload);
  }
}
