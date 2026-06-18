import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Venue, TimeSlot, VenueFilter, VenueSort } from '../../domain/entities/venue';
import { GetVenuesUseCase } from '../../application/venue/get-venues.usecase';
import { GetVenueByIdUseCase } from '../../application/venue/get-venue-by-id.usecase';
import { GetSlotsForVenueUseCase } from '../../application/venue/get-slots-for-venue.usecase';
import { AddVenueUseCase } from '../../application/venue/add-venue.usecase';
import { UpdateVenueUseCase } from '../../application/venue/update-venue.usecase';
import { DeleteVenueUseCase } from '../../application/venue/delete-venue.usecase';

@Injectable({
  providedIn: 'root'
})
export class VenueService {
  private getVenuesUseCase = inject(GetVenuesUseCase);
  private getVenueByIdUseCase = inject(GetVenueByIdUseCase);
  private getSlotsForVenueUseCase = inject(GetSlotsForVenueUseCase);
  private addVenueUseCase = inject(AddVenueUseCase);
  private updateVenueUseCase = inject(UpdateVenueUseCase);
  private deleteVenueUseCase = inject(DeleteVenueUseCase);

  getVenues(filter?: VenueFilter, sort?: VenueSort): Observable<Venue[]> {
    return this.getVenuesUseCase.execute(filter, sort);
  }

  getVenueById(id: string): Observable<Venue | undefined> {
    return this.getVenueByIdUseCase.execute(id);
  }

  getSlotsForVenue(venueId: string, dateStr: string): Observable<TimeSlot[]> {
    return this.getSlotsForVenueUseCase.execute(venueId, dateStr);
  }

  addVenue(venue: Omit<Venue, 'venueId' | 'rating'>): Observable<Venue> {
    return this.addVenueUseCase.execute(venue);
  }

  updateVenue(venue: Venue): Observable<Venue> {
    return this.updateVenueUseCase.execute(venue);
  }

  deleteVenue(id: string): Observable<boolean> {
    return this.deleteVenueUseCase.execute(id);
  }
}
