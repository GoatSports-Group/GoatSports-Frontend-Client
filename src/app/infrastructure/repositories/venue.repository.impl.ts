import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { VenueRepository } from '@application/ports/venue.repository';
import { Venue, TimeSlot } from '@domain/entity/venue';
import { VenueFilter, VenueSort } from '@application/dto/venue/venue.dto';
import { SportType } from '@domain/enums/sport-type.enum';
import { VenueStatus } from '@domain/enums/venue-status.enum';
import { BookingStatus } from '@domain/enums/booking-status.enum';

@Injectable({
  providedIn: 'root'
})
export class VenueRepositoryImpl implements VenueRepository {
  private venuesKey = 'goatsports_venues';

  private defaultVenues: Venue[] = [
    {
      venueId: 'v1',
      name: 'Sân Bóng Đá Mini Tuyên Sơn Đà Nẵng',
      description: 'Cụm sân cỏ nhân tạo đạt chuẩn FIFA, hệ thống chiếu sáng LED hiện đại, mặt sân bằng phẳng, thoát nước tốt. Có dịch vụ thuê trọng tài và áo tập.',
      sportType: SportType.SOCCER,
      address: '22 Đường 2 Tháng 9, Hải Châu, Đà Nẵng',
      pricePerHour: 180000,
      rating: 4.8,
      imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80',
        'https://images.unsplash.com/photo-1518063319789-7217e6706b04?w=800&q=80',
        'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80'
      ],
      facilities: ['Wifi miễn phí', 'Bãi đỗ xe ô tô', 'Căng tin giải khát', 'Phòng thay đồ', 'Hệ thống tắm nóng lạnh'],
      openingHours: '05:00 - 23:00',
      status: VenueStatus.AVAILABLE,
      location: '16.0372, 108.2238'
    },
    {
      venueId: 'v2',
      name: 'CLB Cầu Lông Kỳ Đồng Quận 3',
      description: 'Sân cầu lông Kỳ Đồng sở hữu 6 sân thảm chuyên dụng chống trượt cao cấp. Khoảng cách giữa các sân rộng rãi, có khán đài mini.',
      sportType: SportType.BADMINTON,
      address: '55 Kỳ Đồng, Phường 9, Quận 3, TP. Hồ Chí Minh',
      pricePerHour: 80000,
      rating: 4.6,
      imageUrl: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80',
        'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=80'
      ],
      facilities: ['Wifi miễn phí', 'Bãi đỗ xe máy', 'Cửa hàng dụng cụ', 'Thuê vợt & giày', 'Tủ đồ khóa riêng'],
      openingHours: '06:00 - 22:00',
      status: VenueStatus.AVAILABLE,
      location: '10.7825, 106.6811'
    },
    {
      venueId: 'v3',
      name: 'Sân Tennis Khách Sạn Phú Thọ Quận 11',
      description: 'Cụm 4 sân tennis mặt cứng tiêu chuẩn thi đấu quốc tế. Không gian thoáng đãng, nhiều cây xanh, huấn luyện viên chuyên nghiệp hướng dẫn.',
      sportType: SportType.TENNIS,
      address: '215A Lý Thường Kiệt, Phường 15, Quận 11, TP. Hồ Chí Minh',
      pricePerHour: 150000,
      rating: 4.5,
      imageUrl: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&q=80',
        'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800&q=80'
      ],
      facilities: ['Wifi miễn phí', 'Bãi đỗ xe ô tô', 'Cho thuê máy bắn bóng', 'Căng tin giải khát', 'Tắm nóng lạnh'],
      openingHours: '06:00 - 22:00',
      status: VenueStatus.AVAILABLE,
      location: '10.7689, 106.6582'
    },
    {
      venueId: 'v4',
      name: 'Thảo Điền Pickleball Premium Hub',
      description: 'Môn thể thao thịnh hành nhất hiện nay! Cụm sân Pickleball trong nhà có mái che mát mẻ tại Thảo Điền. Thảm chuyên dụng nhập khẩu từ Mỹ.',
      sportType: SportType.PICKLEBALL,
      address: '12 Đường Thảo Điền, Thảo Điền, Quận 2, TP. Hồ Chí Minh',
      pricePerHour: 120000,
      rating: 4.9,
      imageUrl: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80',
        'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&q=80'
      ],
      facilities: ['Wifi miễn phí', 'Bãi đỗ xe ô tô', 'Máy lạnh sảnh chờ', 'Thuê vợt Pickleball', 'Nước uống miễn phí'],
      openingHours: '06:00 - 23:00',
      status: VenueStatus.AVAILABLE,
      location: '10.8034, 106.7324'
    },
    {
      venueId: 'v5',
      name: 'Nhà Thi Đấu Bóng Rổ Phan Đình Phùng Quận 3',
      description: 'Sân bóng rổ trong nhà với sàn gỗ sồi chống sốc chuẩn quốc tế, bảng rổ điện tử, chuyên tổ trì giải VBA.',
      sportType: SportType.BASKETBALL,
      address: '8 Võ Văn Tần, Phường 6, Quận 3, TP. Hồ Chí Minh',
      pricePerHour: 250000,
      rating: 4.7,
      imageUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80',
        'https://images.unsplash.com/photo-1519766304817-4f37bda74a27?w=800&q=80'
      ],
      facilities: ['Wifi miễn phí', 'Hệ thống âm thanh', 'Khán đài rộng', 'Bãi đỗ xe máy', 'Tắm nóng lạnh'],
      openingHours: '07:00 - 22:00',
      status: VenueStatus.AVAILABLE,
      location: '10.7788, 106.6905'
    },
    {
      venueId: 'v6',
      name: 'Sân Bóng Chuyền Ngoài Trời Công Viên Tao Đàn',
      description: 'Sân cát tiêu chuẩn và sân bê tông phủ sơn thể thao bám dính cực tốt. Thuộc khuôn viên công viên mát mẻ trong lành.',
      sportType: SportType.VOLLEYBALL,
      address: '55C Nguyễn Thị Minh Khai, Bến Thành, Quận 1, TP. Hồ Chí Minh',
      pricePerHour: 100000,
      rating: 4.4,
      imageUrl: 'https://images.unsplash.com/photo-1592656094270-b998cb743d50?w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1592656094270-b998cb743d50?w=800&q=80',
        'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=80'
      ],
      facilities: ['Wifi công cộng', 'Bãi đỗ xe máy', 'Khu nghỉ ngơi bóng mát', 'Căng tin giải khát'],
      openingHours: '05:00 - 22:00',
      status: VenueStatus.AVAILABLE,
      location: '10.7744, 106.6923'
    },
    {
      venueId: 'v7',
      name: 'Bình Thạnh Pickleball Arena',
      description: 'Sân Pickleball ngoài trời quy mô lớn tại Bình Thạnh, thảm chuyên dụng chống chói, hệ thống đèn chiếu sáng đêm cực sáng.',
      sportType: SportType.PICKLEBALL,
      address: '320 Ung Văn Khiêm, Phường 25, Bình Thạnh, TP. Hồ Chí Minh',
      pricePerHour: 110000,
      rating: 4.8,
      imageUrl: 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=800&q=80',
        'https://images.unsplash.com/photo-1602211844066-d3bb556e983b?w=800&q=80'
      ],
      facilities: ['Wifi miễn phí', 'Bãi đỗ xe máy/ô tô', 'Căng tin giải khát', 'Thuê vợt & bóng', 'Ghế khán giả có ô'],
      openingHours: '05:30 - 22:30',
      status: VenueStatus.AVAILABLE,
      location: '10.8037, 106.7169'
    },
    {
      venueId: 'v8',
      name: 'Sân Bóng Đá Phú Nhuận Club',
      description: 'Sân cỏ nhân tạo Phú Nhuận chất lượng cao, lưới bao quanh sân an toàn, nằm ở trung tâm dễ di chuyển.',
      sportType: SportType.SOCCER,
      address: '3 Hoàng Minh Giám, Phường 9, Phú Nhuận, TP. Hồ Chí Minh',
      pricePerHour: 190000,
      rating: 4.5,
      imageUrl: 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1518063319789-7217e6706b04?w=800&q=80',
        'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80'
      ],
      facilities: ['Wifi miễn phí', 'Bãi đỗ xe máy', 'Tắm nóng lạnh', 'Cho thuê áo bib', 'Phòng chờ máy lạnh'],
      openingHours: '05:00 - 23:00',
      status: VenueStatus.AVAILABLE,
      location: '10.8055, 106.6788'
    }
  ];

  constructor() {
    this.initVenues();
  }

  private initVenues() {
    if (!localStorage.getItem(this.venuesKey)) {
      localStorage.setItem(this.venuesKey, JSON.stringify(this.defaultVenues));
    }
  }

  private getStoredVenues(): Venue[] {
    const data = localStorage.getItem(this.venuesKey);
    return data ? JSON.parse(data) : this.defaultVenues;
  }

  private saveVenues(venues: Venue[]) {
    localStorage.setItem(this.venuesKey, JSON.stringify(venues));
  }

  getVenues(filter?: VenueFilter, sort?: VenueSort): Observable<Venue[]> {
    let list = this.getStoredVenues();

    if (filter) {
      if (filter.searchTerm) {
        const term = filter.searchTerm.toLowerCase().trim();
        list = list.filter(v =>
          v.name.toLowerCase().includes(term) ||
          v.address.toLowerCase().includes(term) ||
          v.description.toLowerCase().includes(term)
        );
      }
      if (filter.sportType && filter.sportType !== 'all') {
        const sportTypeLower = filter.sportType.toLowerCase();
        list = list.filter(v => {
          const vTypeLower = v.sportType.toLowerCase();
          return vTypeLower === sportTypeLower ||
            (sportTypeLower === 'soccer' && v.sportType === SportType.SOCCER) ||
            (sportTypeLower === 'badminton' && v.sportType === SportType.BADMINTON) ||
            (sportTypeLower === 'tennis' && v.sportType === SportType.TENNIS) ||
            (sportTypeLower === 'pickleball' && v.sportType === SportType.PICKLEBALL) ||
            (sportTypeLower === 'basketball' && v.sportType === SportType.BASKETBALL) ||
            (sportTypeLower === 'volleyball' && v.sportType === SportType.VOLLEYBALL);
        });
      }
      if (filter.minPrice !== undefined) {
        list = list.filter(v => v.pricePerHour >= (filter.minPrice || 0));
      }
      if (filter.maxPrice !== undefined) {
        list = list.filter(v => v.pricePerHour <= (filter.maxPrice || Infinity));
      }
      if (filter.rating !== undefined) {
        list = list.filter(v => v.rating >= (filter.rating || 0));
      }
      if (filter.area) {
        const areaTerm = filter.area.toLowerCase().trim();
        list = list.filter(v => v.address.toLowerCase().includes(areaTerm));
      }
    }

    if (sort) {
      switch (sort) {
        case 'price-asc':
          list.sort((a, b) => a.pricePerHour - b.pricePerHour);
          break;
        case 'price-desc':
          list.sort((a, b) => b.pricePerHour - a.pricePerHour);
          break;
        case 'rating-desc':
          list.sort((a, b) => b.rating - a.rating);
          break;
        case 'name-asc':
          list.sort((a, b) => a.name.localeCompare(b.name));
          break;
      }
    }

    return of(list).pipe(delay(300));
  }

  getVenueById(id: string): Observable<Venue | undefined> {
    const list = this.getStoredVenues();
    const venue = list.find(v => v.venueId === id);
    return of(venue).pipe(delay(200));
  }

  getSlotsForVenue(venueId: string, dateStr: string): Observable<TimeSlot[]> {
    const venue = this.getStoredVenues().find(v => v.venueId === venueId);
    if (!venue) return of([]);

    const slots: TimeSlot[] = [];
    const basePrice = venue.pricePerHour;

    const bookingData = localStorage.getItem('goatsports_bookings');
    const bookings = bookingData ? JSON.parse(bookingData) : [];

    for (let hour = 6; hour < 22; hour++) {
      const startStr = hour < 10 ? `0${hour}:00` : `${hour}:00`;
      const endStr = (hour + 1) < 10 ? `0${hour + 1}:00` : `${hour + 1}:00`;
      const timeRange = `${startStr} - ${endStr}`;

      const isBooked = bookings.some((b: any) =>
        b.venueId === venueId &&
        b.bookingDate === dateStr &&
        b.timeSlot === timeRange &&
        b.status !== BookingStatus.CANCELLED
      );

      const isPeak = hour >= 17 && hour <= 20;
      const price = isPeak ? basePrice + 30000 : basePrice;

      slots.push({
        slotId: `${venueId}_${dateStr}_${hour}`,
        time: timeRange,
        isAvailable: !isBooked,
        price: price
      });
    }

    return of(slots).pipe(delay(150));
  }

  addVenue(venue: Omit<Venue, 'venueId' | 'rating'>): Observable<Venue> {
    const list = this.getStoredVenues();
    const newVenue: Venue = {
      ...venue,
      venueId: 'v_' + Math.random().toString(36).substr(2, 9),
      rating: 5.0
    };
    list.push(newVenue);
    this.saveVenues(list);
    return of(newVenue).pipe(delay(300));
  }

  updateVenue(venue: Venue): Observable<Venue> {
    const list = this.getStoredVenues();
    const index = list.findIndex(v => v.venueId === venue.venueId);
    if (index !== -1) {
      list[index] = { ...venue };
      this.saveVenues(list);
    }
    return of(venue).pipe(delay(300));
  }

  deleteVenue(id: string): Observable<boolean> {
    let list = this.getStoredVenues();
    const initialLength = list.length;
    list = list.filter(v => v.venueId !== id);
    this.saveVenues(list);
    return of(list.length < initialLength).pipe(delay(300));
  }
}
