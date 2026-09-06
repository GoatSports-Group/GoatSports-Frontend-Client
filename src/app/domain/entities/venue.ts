import { SportType } from '@domain/enums/sport-type.enum';

export interface VenueCourt {
  venueCourtId: string;
  sportType: SportType;
  name: string;
  capacity: number;
  pricePerHour: number;
  indoor: boolean;
  active: boolean;
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
  latitude?: number;
  longitude?: number;
  imageUrls: string[];
  amenities: string[];
  sportTypes?: string[];
  totalCourts?: number;
  distanceKm?: number;
  courts?: VenueCourt[];
}
