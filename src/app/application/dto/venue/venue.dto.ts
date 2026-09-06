export { SportType, SPORT_TYPE_OPTIONS } from '@domain/enums/sport-type.enum';
export { Venue, VenueCourt } from '@domain/entities/venue';

export interface VenueSearchFilter {
  keyword?: string;
  sportType?: string;
  district?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  page?: number;
  size?: number;
}