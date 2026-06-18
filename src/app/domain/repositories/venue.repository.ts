import { Observable } from 'rxjs';
import { Venue, TimeSlot, VenueFilter, VenueSort } from '../entities/venue';

export interface VenueRepository {
  getVenues(filter?: VenueFilter, sort?: VenueSort): Observable<Venue[]>;
  getVenueById(id: string): Observable<Venue | undefined>;
  getSlotsForVenue(venueId: string, dateStr: string): Observable<TimeSlot[]>;
  addVenue(venue: Omit<Venue, 'venueId' | 'rating'>): Observable<Venue>;
  updateVenue(venue: Venue): Observable<Venue>;
  deleteVenue(id: string): Observable<boolean>;
}
