import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { AIRecommendationRequest, AIRecommendationResult } from '../models/recommendation.model';
import { VenueService } from './venue.service';

@Injectable({
  providedIn: 'root'
})
export class RecommendationService {
  private venueService = inject(VenueService);

  getRecommendations(request: AIRecommendationRequest): Observable<AIRecommendationResult[]> {
    return this.venueService.getVenues().pipe(
      delay(1200), // Simulate heavy AI computations & search
      map(venues => {
        let matchedVenues = venues;
        
        // Filter by sport type if specified
        if (request.sportType && request.sportType !== 'all') {
          matchedVenues = venues.filter(v => v.sportType === request.sportType);
        }

        const results: AIRecommendationResult[] = matchedVenues.map(venue => {
          let score = 75; // Base matching score
          const reasons: string[] = [];

          // 1. Budget comparison
          if (venue.pricePerHour <= request.budget) {
            score += 15;
            reasons.push(`Giá thuê cực tốt: chỉ ${venue.pricePerHour.toLocaleString('vi-VN')}đ/giờ (tiết kiệm hơn ngân sách của bạn).`);
          } else {
            const difference = venue.pricePerHour - request.budget;
            const percentage = (difference / request.budget) * 100;
            if (percentage < 25) {
              score += 2;
              reasons.push(`Giá thuê (${venue.pricePerHour.toLocaleString('vi-VN')}đ/giờ) cao hơn một chút so với ngân sách mong muốn nhưng chất lượng rất xứng đáng.`);
            } else {
              score -= 12;
              reasons.push(`Giá thuê vượt ngân sách của bạn. Tuy nhiên, đây là sân có chất lượng dịch vụ chuẩn 5 sao.`);
            }
          }

          // 2. Rating factor
          if (venue.rating >= 4.7) {
            score += 8;
            reasons.push(`Chất lượng hàng đầu: Đạt đánh giá ${venue.rating}/5.0 từ cộng đồng người chơi.`);
          } else if (venue.rating >= 4.5) {
            score += 4;
            reasons.push(`Đánh giá tốt: ${venue.rating}/5.0 sao với phản hồi tích cực.`);
          }

          // 3. Location factor
          const requestLoc = request.location.toLowerCase().trim();
          const venueAddr = venue.address.toLowerCase();
          
          let dist = 1.5; // default simulated distance
          if (requestLoc) {
            if (venueAddr.includes(requestLoc)) {
              score += 10;
              dist = parseFloat((Math.random() * 1.2 + 0.3).toFixed(1));
              reasons.push(`Vị trí vô cùng thuận tiện: Nằm ngay tại khu vực ${request.location} (chỉ cách bạn khoảng ${dist}km).`);
            } else {
              dist = parseFloat((Math.random() * 4 + 1.8).toFixed(1));
              reasons.push(`Khoảng cách trung bình: Cách bạn khoảng ${dist}km, giao thông di chuyển thuận tiện.`);
            }
          } else {
            dist = parseFloat((Math.random() * 2 + 0.8).toFixed(1));
            reasons.push(`Vị trí thuận lợi: Cách trung tâm chỉ khoảng ${dist}km.`);
          }

          // 4. Availability & time slots
          score += 5; // Assumed matching slot
          const timeLabel = request.preferredTime === 'Morning' ? 'buổi sáng' : request.preferredTime === 'Afternoon' ? 'buổi chiều' : 'buổi tối';
          reasons.push(`Lịch trống tối ưu: Vẫn còn nhiều khung giờ vàng trống vào ${timeLabel} ngày ${request.preferredDate}.`);

          // 5. Facilities additions
          if (venue.facilities.length >= 4) {
            reasons.push(`Đầy đủ tiện ích premium: ${venue.facilities.slice(0, 3).join(', ')} và nhiều dịch vụ đi kèm khác.`);
          }

          // Ensure score bounds
          score = Math.min(Math.max(score, 45), 99);

          return {
            venue,
            matchScore: score,
            reasons
          };
        });

        // Sort by match score descending
        return results.sort((a, b) => b.matchScore - a.matchScore);
      })
    );
  }
}
