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

export interface VenueFacilityLayoutItem {
  id: string;
  type: 'COURT' | 'RECEPTION' | 'ENTRANCE' | 'PARKING' | 'LOCKER' | 'WC'
    | 'WAITING' | 'CAFE' | 'STORAGE' | 'CUSTOM';
  courtId?: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zoneId?: string;
  icon?: string;
}

export interface VenueFacilityLayoutZone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VenueFacilityLayout {
  version: number;
  venueId: string;
  items: VenueFacilityLayoutItem[];
  zones: VenueFacilityLayoutZone[];
  updatedAt?: string;
}

export interface VenueCancellationPolicy {
  fullRefundHoursBefore: number;
  partialRefundHoursBefore: number;
  partialRefundPercentage: number;
  noRefundHoursBefore: number;
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
  facilityLayout?: VenueFacilityLayout | null;
  cancellationPolicy?: VenueCancellationPolicy | null;
  sportTypes?: string[];
  totalCourts?: number;
  distanceKm?: number | null;
  courts?: VenueCourt[];
}
