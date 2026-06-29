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

export { Venue, TimeSlot } from '@domain/entity/venue';
export { SportType, SPORT_TYPE_OPTIONS } from '@domain/enums/sport-type.enum';
export { VenueStatus, VENUE_STATUS_OPTIONS } from '@domain/enums/venue-status.enum';

