import { Observable } from 'rxjs';
import { MatchmakingSessionModel, VenueRecommendationModel, ChatbotResponseModel } from '@domain/models/matchmaking.model';

export abstract class AiRepositoryPort {
  abstract joinMatchmakingQueue(payload: {
    playerId: string;
    playerName: string;
    playerAvatar?: string;
    sport: string;
    skillLevel: string;
    eloRating?: number;
    locationLat: number;
    locationLng: number;
    maxDistanceKm?: number;
  }): Observable<{ status: string; message: string; session?: MatchmakingSessionModel }>;

  abstract checkMatchmakingStatus(playerId: string): Observable<{ status: string; queue_size?: number; session?: MatchmakingSessionModel }>;
  abstract leaveMatchmakingQueue(playerId: string): Observable<{ success: boolean; message: string }>;
  abstract getVenueRecommendations(lat?: number, lng?: number, sport?: string): Observable<VenueRecommendationModel[]>;
  abstract queryChatbot(message: string, lat?: number, lng?: number, sport?: string): Observable<ChatbotResponseModel>;
}
