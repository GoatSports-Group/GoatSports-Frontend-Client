export { SportType, SPORT_TYPE_OPTIONS } from '@domain/enums/sport-type.enum';
export {
  Venue,
  VenueCourt,
  VenueFacilityLayout,
  VenueFacilityLayoutItem,
  VenueFacilityLayoutZone
} from '@domain/entities/venue';

export interface VenueSearchFilter {
  keyword?: string;
  sportType?: string;
  district?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  northLatitude?: number;
  southLatitude?: number;
  eastLongitude?: number;
  westLongitude?: number;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  page?: number;
  size?: number;
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  title: string;
  address: string;
}
