import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AiRepositoryPort } from '@application/ports/ai.repository.port';
import {
  AcceptanceDecision,
  ChatbotResponseModel,
  JoinMatchmakingQueueRequest,
  MatchmakingActionResponse,
  MatchmakingModelStatus,
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

  override getMatchmakingModel(): Observable<MatchmakingModelStatus> {
    return this.http.get<MatchmakingModelStatus>(`${this.baseUrl}/matchmaking/model`);
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

  override shareMatch(sessionId: string, title: string, content: string | null): Observable<string> {
    return this.http.post<{ postId: string }>(`${this.baseUrl}/matchmaking/sessions/${sessionId}/share`, { title, content })
      .pipe(map(response => response.postId));
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

  override getVenueRecommendations(lat: number, lng: number, sport: string, radiusKm: number, maxResults: number): Observable<VenueRecommendationModel[]> {
    const params = new HttpParams()
      .set('user_lat', String(lat))
      .set('user_lng', String(lng))
      .set('sport_type', sport)
      .set('radius_km', String(radiusKm))
      .set('max_results', String(maxResults));
    return this.http.get<VenueRecommendationModel[]>(`${this.baseUrl}/recommendations/venues`, { params });
  }

  override getPersonalization(): Observable<boolean> {
    return this.http.get<{ enabled: boolean }>(`${this.baseUrl}/personalization/settings`).pipe(map(res => res.enabled));
  }

  override setPersonalization(enabled: boolean): Observable<boolean> {
    return this.http.put<{ enabled: boolean }>(`${this.baseUrl}/personalization/settings`, { enabled }).pipe(map(res => res.enabled));
  }

  override reportUnhelpfulAnswer(question: string, answer: string, conversationId: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/chatbot/feedback`, { question, answer, conversationId });
  }

  override queryChatbot(message: string, conversationId: string): Observable<ChatbotResponseModel> {
    return this.http.post<ChatbotResponseModel>(`${this.baseUrl}/chatbot/query`, { message, conversationId });
  }
}
