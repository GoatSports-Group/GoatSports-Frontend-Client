import { Observable } from 'rxjs';
import {
  AcceptanceDecision,
  ChatbotResponseModel,
  JoinMatchmakingQueueRequest,
  MatchmakingActionResponse,
  MatchCandidate,
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
  abstract getMatchmakingHistory(limit?: number, offset?: number): Observable<MatchmakingSessionModel[]>;
  abstract getMatchmakingCandidates(limit?: number): Observable<MatchCandidate[]>;
  abstract selectMatchmakingCandidate(candidateParticipantId: string): Observable<MatchmakingSessionModel>;
  abstract decideMatch(sessionId: string, decision: AcceptanceDecision): Observable<MatchmakingSessionModel>;
  abstract updateMatchProposal(
    sessionId: string,
    payload: { bookingId?: string; status?: 'BOOKING_PENDING' | 'BOOKED' | 'CANCELLED' }
  ): Observable<MatchmakingSessionModel>;
  abstract selectMatchVenue(sessionId: string, venueId: string, venueCourtId: string): Observable<MatchmakingSessionModel>;
  abstract refreshMatchVenues(sessionId: string): Observable<MatchmakingSessionModel>;
  abstract cancelMatchmakingSession(sessionId: string): Observable<MatchmakingSessionModel>;
  abstract registerMatchBooking(sessionId: string, bookingId: string): Observable<MatchmakingSessionModel>;
  abstract submitMatchResult(sessionId: string, myScore: number, opponentScore: number): Observable<MatchmakingSessionModel>;
  abstract submitOpponentFeedback(sessionId: string, rating: number, fairPlayRating: number, comment?: string): Observable<MatchmakingSessionModel>;
  abstract getVenueRecommendations(lat?: number, lng?: number, sport?: string): Observable<VenueRecommendationModel[]>;
  abstract queryChatbot(message: string, lat?: number, lng?: number, sport?: string): Observable<ChatbotResponseModel>;
}
