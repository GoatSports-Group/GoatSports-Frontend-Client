import { BookingStatus } from '../enums/booking-status.enum';
import { SportType } from '../enums/sport-type.enum';

export interface Booking {
  bookingId: string;
  venueId: string;
  venueName: string;
  venueImage: string;
  sportType: SportType;
  bookingDate: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "08:00 - 09:00"
  fullName: string;
  phone: string;
  email: string;
  totalPrice: number;
  numberOfPlayers: number;
  notes?: string;
  status: BookingStatus;
  createdAt: string;
}
