import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../shared/shared.module';
import { ClientRoutingModule } from './routes/client-routing.module';

// Layout & Components
import { ClientComponent } from './layouts/client.component';
import { HomeComponent } from './pages/client/home/home.component';
import { VenueListComponent } from './pages/client/venue-list/venue-list.component';
import { VenueDetailComponent } from './pages/client/venue-detail/venue-detail.component';
import { BookingCheckoutComponent } from './pages/client/booking-checkout/booking-checkout.component';
import { MyBookingsComponent } from './pages/client/my-bookings/my-bookings.component';
import { AiRecommendationComponent } from './pages/client/ai-recommendation/ai-recommendation.component';
import { ProfileComponent } from './pages/client/profile/profile.component';

@NgModule({
  declarations: [
    ClientComponent,
    HomeComponent,
    VenueListComponent,
    VenueDetailComponent,
    BookingCheckoutComponent,
    MyBookingsComponent,
    AiRecommendationComponent,
    ProfileComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    ClientRoutingModule
  ]
})
export class ClientModule { }
