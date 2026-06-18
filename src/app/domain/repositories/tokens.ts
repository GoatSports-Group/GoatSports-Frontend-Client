import { InjectionToken } from '@angular/core';
import { AuthRepository } from './auth.repository';
import { BookingRepository } from './booking.repository';
import { ReviewRepository } from './review.repository';
import { VenueRepository } from './venue.repository';

export const AUTH_REPOSITORY_TOKEN = new InjectionToken<AuthRepository>('AuthRepository');
export const BOOKING_REPOSITORY_TOKEN = new InjectionToken<BookingRepository>('BookingRepository');
export const REVIEW_REPOSITORY_TOKEN = new InjectionToken<ReviewRepository>('ReviewRepository');
export const VENUE_REPOSITORY_TOKEN = new InjectionToken<VenueRepository>('VenueRepository');
