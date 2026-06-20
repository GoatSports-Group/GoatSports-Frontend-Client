import { SportType } from '@domain/enums/sport-type.enum';
import { VenueStatus } from '@domain/enums/venue-status.enum';

export interface Venue {
  venueId: string;
  name: string;
  description: string;
  sportType: SportType;
  address: string;
  pricePerHour: number;
  rating: number;
  imageUrl: string;
  images: string[];
  facilities: string[];
  openingHours: string; // e.g. "06:00 - 22:00"
  status: VenueStatus;
  location?: string;
}

export interface TimeSlot {
  slotId: string;
  time: string; // e.g. "08:00 - 09:00"
  isAvailable: boolean;
  price: number;
}
