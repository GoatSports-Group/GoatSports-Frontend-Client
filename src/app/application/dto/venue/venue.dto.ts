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
export { SportType } from '@domain/enums/sport-type.enum';
export { VenueStatus } from '@domain/enums/venue-status.enum';

