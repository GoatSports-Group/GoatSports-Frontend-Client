import { Observable } from 'rxjs';
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

export abstract class AiRepositoryPort {
  abstract joinMatchmakingQueue(payload: JoinMatchmakingQueueRequest): Observable<MatchmakingQueueResponse>;
  abstract checkMatchmakingStatus(): Observable<MatchmakingStatusResponse>;
  abstract leaveMatchmakingQueue(): Observable<MatchmakingActionResponse>;
  abstract getMatchmakingSession(sessionId: string): Observable<MatchmakingSessionModel>;
  abstract getMatchmakingHistory(limit?: number, offset?: number): Observable<MatchmakingSessionModel[]>;
  abstract getMatchmakingCandidates(limit?: number): Observable<MatchCandidate[]>;
  abstract getMatchmakingModel(): Observable<MatchmakingModelStatus>;
  abstract selectMatchmakingCandidate(candidateParticipantId: string): Observable<MatchmakingSessionModel>;
  abstract decideMatch(sessionId: string, decision: AcceptanceDecision): Observable<MatchmakingSessionModel>;
  abstract updateMatchProposal(
    sessionId: string,
    payload: { bookingId?: string; status?: 'BOOKING_PENDING' | 'BOOKED' | 'CANCELLED' }
  ): Observable<MatchmakingSessionModel>;
  abstract selectMatchVenue(sessionId: string, venueId: string, venueCourtId?: string): Observable<MatchmakingSessionModel>;
  abstract refreshMatchVenues(sessionId: string): Observable<MatchmakingSessionModel>;
  abstract cancelMatchmakingSession(sessionId: string): Observable<MatchmakingSessionModel>;
  abstract registerMatchBooking(sessionId: string, bookingId: string): Observable<MatchmakingSessionModel>;
  abstract submitMatchResult(sessionId: string, myScore: number, opponentScore: number): Observable<MatchmakingSessionModel>;
  /** Khoe tran len Cong dong (gan the doi thu); tra id bai viet. */
  abstract shareMatch(sessionId: string, title: string, content: string | null): Observable<string>;
  abstract submitOpponentFeedback(sessionId: string, rating: number, fairPlayRating: number, comment?: string): Observable<MatchmakingSessionModel>;
  /** Sân hợp thói quen (đặt, xem sân) quanh vị trí; chưa có thói quen thì xếp theo gần + đánh giá. */
  abstract getVenueRecommendations(lat: number, lng: number, sport: string, radiusKm: number, maxResults: number): Observable<VenueRecommendationModel[]>;
  /** Cho phép dùng hoạt động của mình để gợi ý (mặc định bật). Tắt thì hệ thống xóa lịch sử hoạt động đã lưu. */
  abstract getPersonalization(): Observable<boolean>;
  abstract setPersonalization(enabled: boolean): Observable<boolean>;
  /** conversationId: cùng mã thì trợ lý nhớ vài lượt trước (hiểu câu hỏi nối tiếp). */
  abstract queryChatbot(message: string, conversationId: string): Observable<ChatbotResponseModel>;
  /** "Chưa hữu ích": câu hỏi vào hàng chờ để quản trị viên bổ sung kiến thức cho trợ lý. */
  abstract reportUnhelpfulAnswer(question: string, answer: string, conversationId: string): Observable<unknown>;
}
