import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Review } from '../models/review.model';

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private reviewsKey = 'goatsports_reviews';

  private defaultReviews: Review[] = [
    {
      reviewId: 'r_1',
      venueId: 'v1',
      userFullName: 'Lê Minh Hoàng',
      userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80',
      rating: 5,
      comment: 'Sân cực kỳ đẹp, cỏ nhân tạo mới tinh chạy êm chân lắm. Hệ thống đèn LED chiếu rất sáng, không bị lóa mắt. Có phòng thay đồ sạch sẽ.',
      createdAt: '2026-06-10T15:00:00Z'
    },
    {
      reviewId: 'r_2',
      venueId: 'v1',
      userFullName: 'Phan Tuấn Hải',
      userAvatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&q=80',
      rating: 4,
      comment: 'Sân tốt, giá cả hợp lý. Điểm trừ duy nhất là căng tin hơi đông vào giờ cao điểm, phải đợi mua nước hơi lâu.',
      createdAt: '2026-06-08T20:30:00Z'
    },
    {
      reviewId: 'r_3',
      venueId: 'v2',
      userFullName: 'Trần Nguyễn Duy',
      userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80',
      rating: 5,
      comment: 'Thảm cầu lông xịn chống trượt tốt. Trần nhà cao và không bị gió lùa, ánh sáng bố trí đều các góc sân, rất đáng tiền!',
      createdAt: '2026-06-11T09:00:00Z'
    },
    {
      reviewId: 'r_4',
      venueId: 'v2',
      userFullName: 'Vũ Hoàng Nam',
      userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80',
      rating: 4,
      comment: 'Vị trí trung tâm Quận 3 rất thuận tiện di chuyển. Sân hơi sát nhau một tí nhưng thảm êm và phòng tắm sạch sẽ.',
      createdAt: '2026-06-09T18:15:00Z'
    },
    {
      reviewId: 'r_5',
      venueId: 'v4',
      userFullName: 'Nguyễn Diệp Chi',
      userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80',
      rating: 5,
      comment: 'Sân Pickleball mới tinh trong nhà cực mát, không lo trời nắng mưa. Nhân viên thân thiện, cho thuê vợt xịn sò luôn.',
      createdAt: '2026-06-11T16:00:00Z'
    },
    {
      reviewId: 'r_6',
      venueId: 'v3',
      userFullName: 'Hoàng Quốc Bảo',
      userAvatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&q=80',
      rating: 4,
      comment: 'Sân tennis mặt cứng nảy đều, sơn sân bám chân tốt. Có chỗ gửi ô tô thoải mái và căng tin nhiều nước mát.',
      createdAt: '2026-06-05T17:00:00Z'
    }
  ];

  constructor() {
    this.initReviews();
  }

  private initReviews() {
    if (!localStorage.getItem(this.reviewsKey)) {
      localStorage.setItem(this.reviewsKey, JSON.stringify(this.defaultReviews));
    }
  }

  private getStoredReviews(): Review[] {
    const data = localStorage.getItem(this.reviewsKey);
    return data ? JSON.parse(data) : this.defaultReviews;
  }

  private saveReviews(reviews: Review[]) {
    localStorage.setItem(this.reviewsKey, JSON.stringify(reviews));
  }

  getReviewsByVenue(venueId: string): Observable<Review[]> {
    const all = this.getStoredReviews();
    const filtered = all.filter(r => r.venueId === venueId);
    // Sort newest reviews first
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return of(filtered).pipe(delay(150));
  }

  addReview(venueId: string, rating: number, comment: string, userFullName: string): Observable<Review> {
    const all = this.getStoredReviews();
    const newReview: Review = {
      reviewId: 'r_' + Math.random().toString(36).substr(2, 9),
      venueId,
      userFullName,
      userAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userFullName)}`,
      rating,
      comment,
      createdAt: new Date().toISOString()
    };
    all.push(newReview);
    this.saveReviews(all);

    // Update the average rating for the venue
    this.updateVenueRating(venueId);

    return of(newReview).pipe(delay(200));
  }

  deleteReview(id: string): Observable<boolean> {
    let all = this.getStoredReviews();
    const reviewToDelete = all.find(r => r.reviewId === id);
    const initialLength = all.length;
    all = all.filter(r => r.reviewId !== id);
    this.saveReviews(all);

    if (reviewToDelete) {
      this.updateVenueRating(reviewToDelete.venueId);
    }

    return of(all.length < initialLength).pipe(delay(200));
  }

  getAllReviews(): Observable<Review[]> {
    const all = this.getStoredReviews();
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return of(all).pipe(delay(200));
  }

  private updateVenueRating(venueId: string) {
    const reviews = this.getStoredReviews().filter(r => r.venueId === venueId);
    const avgRating = reviews.length > 0 
      ? parseFloat((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1))
      : 5.0;

    const venueData = localStorage.getItem('goatsports_venues');
    if (venueData) {
      const venues = JSON.parse(venueData);
      const index = venues.findIndex((v: any) => v.venueId === venueId);
      if (index !== -1) {
        venues[index].rating = avgRating;
        localStorage.setItem('goatsports_venues', JSON.stringify(venues));
      }
    }
  }
}
