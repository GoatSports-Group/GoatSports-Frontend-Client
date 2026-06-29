import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@shared/shared.module';
import { ClientRoutingModule } from './routes/client-routing.module';

import { ClientComponent } from '@presentation/layouts/client.component';
import { HomeComponent } from '@presentation/pages/client/home/home.component';
import { VenueListComponent } from '@presentation/pages/client/venue-list/venue-list.component';
import { VenueDetailComponent } from '@presentation/pages/client/venue-detail/venue-detail.component';
import { BookingCheckoutComponent } from '@presentation/pages/client/booking-checkout/booking-checkout.component';
import { MyBookingsComponent } from '@presentation/pages/client/my-bookings/my-bookings.component';
import { AiRecommendationComponent } from '@presentation/pages/client/ai-recommendation/ai-recommendation.component';
import { ProfileComponent } from '@presentation/pages/client/profile/profile.component';
import { OwnerApplicationComponent } from '@presentation/pages/client/owner-application/owner-application.component';

@NgModule({
  declarations: [
    ClientComponent,
    HomeComponent,
    VenueListComponent,
    VenueDetailComponent,
    BookingCheckoutComponent,
    MyBookingsComponent,
    AiRecommendationComponent,
    ProfileComponent,
    OwnerApplicationComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    ClientRoutingModule
  ]
})
export class ClientModule { }
