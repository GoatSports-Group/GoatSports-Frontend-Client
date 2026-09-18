import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AiRepositoryPort } from '@application/ports/ai.repository.port';
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
import { API_ENDPOINTS } from '@infrastructure/config/api-endpoints';


@Injectable({ providedIn: 'root' })
export class AiRepository extends AiRepositoryPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = API_ENDPOINTS.ai;

  override joinMatchmakingQueue(payload: JoinMatchmakingQueueRequest): Observable<MatchmakingQueueResponse> {
    return this.http.post<MatchmakingQueueResponse>(`${this.baseUrl}/matchmaking/queue`, payload);
  }

  override checkMatchmakingStatus(): Observable<MatchmakingStatusResponse> {
    return this.http.get<MatchmakingStatusResponse>(`${this.baseUrl}/matchmaking/status`);
  }

  override leaveMatchmakingQueue(): Observable<MatchmakingActionResponse> {
    return this.http.delete<MatchmakingActionResponse>(`${this.baseUrl}/matchmaking/queue`);
  }

  override getMatchmakingSession(sessionId: string): Observable<MatchmakingSessionModel> {
    return this.http.get<MatchmakingSessionModel>(`${this.baseUrl}/matchmaking/sessions/${sessionId}`);
  }

  override getMatchmakingHistory(limit = 5, offset = 0): Observable<MatchmakingSessionModel[]> {
    const params = new HttpParams().set('limit', String(limit)).set('offset', String(offset));
    return this.http.get<MatchmakingSessionModel[]>(`${this.baseUrl}/matchmaking/sessions`, { params });
  }

  override getMatchmakingCandidates(limit = 5): Observable<MatchCandidate[]> {
    const params = new HttpParams().set('limit', String(limit));
    return this.http.get<MatchCandidate[]>(`${this.baseUrl}/matchmaking/candidates`, { params });
  }

  override selectMatchmakingCandidate(candidateParticipantId: string): Observable<MatchmakingSessionModel> {
    return this.http.post<MatchmakingSessionModel>(
      `${this.baseUrl}/matchmaking/candidates/${candidateParticipantId}/select`,
      {}
    );
  }

  override decideMatch(sessionId: string, decision: AcceptanceDecision): Observable<MatchmakingSessionModel> {
    return this.http.post<MatchmakingSessionModel>(
      `${this.baseUrl}/matchmaking/sessions/${sessionId}/acceptances`,
      { decision }
    );
  }

  override updateMatchProposal(
    sessionId: string,
    payload: { bookingId?: string; status?: 'BOOKING_PENDING' | 'BOOKED' | 'CANCELLED' }
  ): Observable<MatchmakingSessionModel> {
    return this.http.patch<MatchmakingSessionModel>(
      `${this.baseUrl}/matchmaking/sessions/${sessionId}/proposal`,
      payload
    );
  }

  override selectMatchVenue(sessionId: string, venueId: string, venueCourtId: string): Observable<MatchmakingSessionModel> {
    return this.http.post<MatchmakingSessionModel>(`${this.baseUrl}/matchmaking/sessions/${sessionId}/venue`, {
      venueId,
      venueCourtId
    });
  }

  override refreshMatchVenues(sessionId: string): Observable<MatchmakingSessionModel> {
    return this.http.post<MatchmakingSessionModel>(
      `${this.baseUrl}/matchmaking/sessions/${sessionId}/venues/refresh`,
      {}
    );
  }

  override cancelMatchmakingSession(sessionId: string): Observable<MatchmakingSessionModel> {
    return this.http.delete<MatchmakingSessionModel>(`${this.baseUrl}/matchmaking/sessions/${sessionId}`);
  }

  override registerMatchBooking(sessionId: string, bookingId: string): Observable<MatchmakingSessionModel> {
    return this.http.post<MatchmakingSessionModel>(`${this.baseUrl}/matchmaking/sessions/${sessionId}/booking`, { bookingId });
  }

  override submitMatchResult(sessionId: string, myScore: number, opponentScore: number): Observable<MatchmakingSessionModel> {
    return this.http.post<MatchmakingSessionModel>(`${this.baseUrl}/matchmaking/sessions/${sessionId}/result`, {
      myScore,
      opponentScore
    });
  }

  override submitOpponentFeedback(
    sessionId: string,
    rating: number,
    fairPlayRating: number,
    comment?: string
  ): Observable<MatchmakingSessionModel> {
    return this.http.post<MatchmakingSessionModel>(`${this.baseUrl}/matchmaking/sessions/${sessionId}/feedback`, {
      rating,
      fairPlayRating,
      comment
    });
  }

  override getVenueRecommendations(lat?: number, lng?: number, sport?: string): Observable<VenueRecommendationModel[]> {
    let params = new HttpParams();
    if (lat != null) params = params.set('user_lat', String(lat));
    if (lng != null) params = params.set('user_lng', String(lng));
    if (sport) params = params.set('sport_type', sport);
    return this.http.get<VenueRecommendationModel[]>(`${this.baseUrl}/recommendations/venues`, { params });
  }

  override queryChatbot(message: string, lat?: number, lng?: number, sport?: string): Observable<ChatbotResponseModel> {
    return this.http.post<ChatbotResponseModel>(`${this.baseUrl}/chatbot/query`, {
      message,
      userLocationLat: lat,
      userLocationLng: lng,
      favoriteSport: sport
    });
  }
}
