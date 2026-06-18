import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import { Booking } from '../../domain/entities/booking';
import { SessionStateService } from '../../domain/models/session-state.service';
import { SportType } from '../../domain/enums/sport-type.enum';
import { BookingStatus } from '../../domain/enums/booking-status.enum';

@Injectable({
  providedIn: 'root'
})
export class BookingRepositoryImpl implements BookingRepository {
  private bookingsKey = 'goatsports_bookings';
  private sessionStateService = inject(SessionStateService);

  private defaultBookings: Booking[] = [
    {
      bookingId: 'b_1',
      venueId: 'v2',
      venueName: 'CLB Cầu Lông Kỳ Đồng Quận 3',
      venueImage: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80',
      sportType: SportType.BADMINTON,
      bookingDate: '2026-06-15',
      timeSlot: '18:00 - 19:00',
      fullName: 'Nguyễn Văn Khách',
      phone: '0123456789',
      email: 'customer@goatsports.com',
      totalPrice: 80000,
      numberOfPlayers: 4,
      notes: 'Xin chuẩn bị thêm 2 ống cầu Hải Yến',
      status: BookingStatus.CONFIRMED,
      createdAt: '2026-06-11T14:30:00Z'
    },
    {
      bookingId: 'b_2',
      venueId: 'v1',
      venueName: 'Sân Bóng Đá Mini Tuyên Sơn Đà Nẵng',
      venueImage: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80',
      sportType: SportType.SOCCER,
      bookingDate: '2026-06-10',
      timeSlot: '19:00 - 20:00',
      fullName: 'Nguyễn Văn Khách',
      phone: '0123456789',
      email: 'customer@goatsports.com',
      totalPrice: 180000,
      numberOfPlayers: 10,
      notes: 'Cần thuê áo bib màu đỏ',
      status: BookingStatus.COMPLETED,
      createdAt: '2026-06-08T09:15:00Z'
    },
    {
      bookingId: 'b_3',
      venueId: 'v4',
      venueName: 'Thảo Điền Pickleball Premium Hub',
      venueImage: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80',
      sportType: SportType.PICKLEBALL,
      bookingDate: '2026-06-18',
      timeSlot: '08:00 - 09:00',
      fullName: 'Nguyễn Văn Khách',
      phone: '0123456789',
      email: 'customer@goatsports.com',
      totalPrice: 120000,
      numberOfPlayers: 2,
      notes: 'Muốn thuê 2 cây vợt Pickleball chất lượng cao',
      status: BookingStatus.PENDING,
      createdAt: '2026-06-12T08:00:00Z'
    },
    {
      bookingId: 'b_4',
      venueId: 'v3',
      venueName: 'Sân Tennis Khách Sạn Phú Thọ Quận 11',
      venueImage: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&q=80',
      sportType: SportType.TENNIS,
      bookingDate: '2026-06-05',
      timeSlot: '16:00 - 17:00',
      fullName: 'Trần Thị Admin',
      phone: '0987654321',
      email: 'admin@goatsports.com',
      totalPrice: 150000,
      numberOfPlayers: 2,
      status: BookingStatus.COMPLETED,
      createdAt: '2026-06-04T10:00:00Z'
    }
  ];

  constructor() {
    this.initBookings();
  }

  private initBookings() {
    if (!localStorage.getItem(this.bookingsKey)) {
      localStorage.setItem(this.bookingsKey, JSON.stringify(this.defaultBookings));
    }
  }

  private getStoredBookings(): Booking[] {
    const data = localStorage.getItem(this.bookingsKey);
    return data ? JSON.parse(data) : this.defaultBookings;
  }

  private saveBookings(bookings: Booking[]) {
    localStorage.setItem(this.bookingsKey, JSON.stringify(bookings));
  }

  getMyBookings(): Observable<Booking[]> {
    const all = this.getStoredBookings();
    const currentUser = this.sessionStateService.getCurrentUser();
    if (!currentUser) return of([]);

    const filtered = all.filter(b => b.email === currentUser.email);
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return of(filtered).pipe(delay(200));
  }

  getAllBookings(): Observable<Booking[]> {
    const all = this.getStoredBookings();
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return of(all).pipe(delay(250));
  }

  createBooking(bookingData: Omit<Booking, 'bookingId' | 'status' | 'createdAt'>): Observable<Booking> {
    const all = this.getStoredBookings();
    const newBooking: Booking = {
      ...bookingData,
      bookingId: 'b_' + Math.random().toString(36).substr(2, 9),
      status: BookingStatus.PENDING,
      createdAt: new Date().toISOString()
    };
    all.push(newBooking);
    this.saveBookings(all);
    return of(newBooking).pipe(delay(300));
  }

  cancelBooking(id: string): Observable<boolean> {
    const all = this.getStoredBookings();
    const index = all.findIndex(b => b.bookingId === id);
    if (index !== -1) {
      all[index].status = BookingStatus.CANCELLED;
      this.saveBookings(all);
      return of(true).pipe(delay(200));
    }
    return of(false).pipe(delay(200));
  }

  updateBookingStatus(id: string, status: BookingStatus): Observable<boolean> {
    const all = this.getStoredBookings();
    const index = all.findIndex(b => b.bookingId === id);
    if (index !== -1) {
      all[index].status = status;
      this.saveBookings(all);
      return of(true).pipe(delay(200));
    }
    return of(false).pipe(delay(200));
  }

  getStats(): Observable<{ totalVenues: number; totalBookings: number; totalRevenue: number; bookingsToday: number }> {
    const bookingData = this.getStoredBookings();
    const activeBookings = bookingData.filter(b => b.status !== BookingStatus.CANCELLED);

    const totalBookings = bookingData.length;
    const totalRevenue = activeBookings.reduce((sum, b) => sum + b.totalPrice, 0);

    const venueData = localStorage.getItem('goatsports_venues');
    const venues = venueData ? JSON.parse(venueData) : [];
    const totalVenues = venues.length;

    const todayStr = new Date().toISOString().split('T')[0];
    const bookingsToday = bookingData.filter(b => b.bookingDate === todayStr).length;

    return of({
      totalVenues,
      totalBookings,
      totalRevenue,
      bookingsToday
    }).pipe(delay(100));
  }
}
