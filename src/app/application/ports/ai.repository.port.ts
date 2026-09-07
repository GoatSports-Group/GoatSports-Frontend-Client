import { Observable } from 'rxjs';
import {
  AcceptanceDecision,
  ChatbotResponseModel,
  JoinMatchmakingQueueRequest,
  MatchmakingActionResponse,
  MatchmakingQueueResponse,
  MatchmakingSessionModel,
  MatchmakingStatusResponse,
  VenueRecommendationModel
} from '@domain/models/matchmaking.model';

export abstract class AiRepositoryPort {
  abstract joinMatchmakingQueue(payload: JoinMatchmakingQueueRequest): Observable<MatchmakingQueueResponse>;
  abstract checkMatchmakingStatus(): Observable<MatchmakingStatusResponse>;
  abstract leaveMatchmakingQueue(): Observable<MatchmakingActionResponse>;
  abstract getMatchmakingSession(sessionId: string): Observable<MatchmakingSessionModel>;
  abstract decideMatch(sessionId: string, decision: AcceptanceDecision): Observable<MatchmakingSessionModel>;
  abstract updateMatchProposal(
    sessionId: string,
    payload: { bookingId?: string; status?: 'BOOKING_PENDING' | 'BOOKED' | 'CANCELLED' }
  ): Observable<MatchmakingSessionModel>;
  abstract getVenueRecommendations(lat?: number, lng?: number, sport?: string): Observable<VenueRecommendationModel[]>;
  abstract queryChatbot(message: string, lat?: number, lng?: number, sport?: string): Observable<ChatbotResponseModel>;
}
