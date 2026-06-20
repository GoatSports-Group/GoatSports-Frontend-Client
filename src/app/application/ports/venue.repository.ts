import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Venue, TimeSlot } from '@domain/entity/venue';
import { VenueFilter, VenueSort } from '@application/dto/venue/venue.dto';

export interface VenueRepository {
  getVenues(filter?: VenueFilter, sort?: VenueSort): Observable<Venue[]>;
  getVenueById(id: string): Observable<Venue | undefined>;
  getSlotsForVenue(venueId: string, dateStr: string): Observable<TimeSlot[]>;
  addVenue(venue: Omit<Venue, 'venueId' | 'rating'>): Observable<Venue>;
  updateVenue(venue: Venue): Observable<Venue>;
  deleteVenue(id: string): Observable<boolean>;
}

export const VENUE_REPOSITORY_TOKEN = new InjectionToken<VenueRepository>('VenueRepository');
