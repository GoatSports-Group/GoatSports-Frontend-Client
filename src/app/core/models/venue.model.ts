import { SportType } from './enums/sport-type.enum';
import { VenueStatus } from './enums/venue-status.enum';

export { SportType, VenueStatus };

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

export interface VenueFilter {
  sportType?: string;
  minPrice?: number;
  maxPrice?: number;
  area?: string;
  rating?: number;
  timeSlot?: string;
  searchTerm?: string;
}

export type VenueSort = 'price-asc' | 'price-desc' | 'rating-desc' | 'name-asc';
