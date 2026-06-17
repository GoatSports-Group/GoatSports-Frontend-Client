import { NgModule } from '@angular/core';
import { ClientRoutingModule } from './client-routing.module';
import { ClientComponent } from './client.component';
import { HomeComponent } from './pages/home/home.component';
import { VenueListComponent } from './pages/venue-list/venue-list.component';
import { VenueDetailComponent } from './pages/venue-detail/venue-detail.component';
import { BookingCheckoutComponent } from './pages/booking-checkout/booking-checkout.component';
import { MyBookingsComponent } from './pages/my-bookings/my-bookings.component';
import { AiRecommendationComponent } from './pages/ai-recommendation/ai-recommendation.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { SharedModule } from '../../shared/shared.module';

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
    ClientRoutingModule,
    SharedModule
  ]
})
export class ClientModule { }
