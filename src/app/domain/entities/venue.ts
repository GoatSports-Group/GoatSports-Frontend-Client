import { SportType } from '@domain/enums/sport-type.enum';

export interface VenueCourt {
  venueCourtId: string;
  venueId?: string;
  sportType: SportType;
  name: string;
  capacity: number;
  surfaceType?: string;
  /** Legacy field kept for the booking form; live pricing is supplied by TimeSlot. */
  pricePerHour?: number;
  indoor?: boolean;
  active: boolean;
  availabilityStatus?: string | null;
  unavailableUntil?: string | null;
}

export interface Venue {
  venueId: string;
  name: string;
  description: string;
  openTime: string;
  closeTime: string;
  active: boolean;
  minPrice: number;
  maxPrice: number;
  averageRating: number;
  totalReviews: number;
  phone: string;
  email: string;
  address: string;
  ward?: string;
  district?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  imageUrls: string[];
  amenities: string[];
  sportTypes?: string[];
  totalCourts?: number;
  distanceKm?: number | null;
  courts?: VenueCourt[];
}
