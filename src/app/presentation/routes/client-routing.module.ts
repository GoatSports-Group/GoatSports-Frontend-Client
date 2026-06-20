import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClientComponent } from '@presentation/layouts/client.component';
import { HomeComponent } from '@presentation/pages/client/home/home.component';
import { VenueListComponent } from '@presentation/pages/client/venue-list/venue-list.component';
import { VenueDetailComponent } from '@presentation/pages/client/venue-detail/venue-detail.component';
import { BookingCheckoutComponent } from '@presentation/pages/client/booking-checkout/booking-checkout.component';
import { MyBookingsComponent } from '@presentation/pages/client/my-bookings/my-bookings.component';
import { AiRecommendationComponent } from '@presentation/pages/client/ai-recommendation/ai-recommendation.component';
import { ProfileComponent } from '@presentation/pages/client/profile/profile.component';
import { AuthGuard } from '@presentation/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: ClientComponent,
    children: [
      { path: 'home', component: HomeComponent },
      { path: 'products', redirectTo: 'venues', pathMatch: 'full' },
      { path: 'venues', component: VenueListComponent },
      { path: 'product/:id', redirectTo: 'venue/:id', pathMatch: 'full' },
      { path: 'venue/:id', component: VenueDetailComponent },
      { path: 'checkout', redirectTo: 'booking', pathMatch: 'full' },
      { path: 'booking', component: BookingCheckoutComponent, canActivate: [AuthGuard] },
      { path: 'my-bookings', component: MyBookingsComponent, canActivate: [AuthGuard] },
      { path: 'ai-recommendation', component: AiRecommendationComponent },
      { path: 'profile', component: ProfileComponent, canActivate: [AuthGuard] },
      { path: '', redirectTo: 'home', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClientRoutingModule { }
