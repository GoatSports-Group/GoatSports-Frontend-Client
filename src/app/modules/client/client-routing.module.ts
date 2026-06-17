import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClientComponent } from './client.component';
import { HomeComponent } from './pages/home/home.component';
import { VenueListComponent } from './pages/venue-list/venue-list.component';
import { VenueDetailComponent } from './pages/venue-detail/venue-detail.component';
import { BookingCheckoutComponent } from './pages/booking-checkout/booking-checkout.component';
import { MyBookingsComponent } from './pages/my-bookings/my-bookings.component';
import { AiRecommendationComponent } from './pages/ai-recommendation/ai-recommendation.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { AuthGuard } from '../../core/guards/auth.guard';

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
