import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClientComponent } from '@shared/layouts/client/client.component';
import { HomeComponent } from '@presentation/pages/client/home/home.component';
import { SettingsComponent } from '@presentation/pages/client/settings/settings.component';
import { NotificationsComponent } from '@presentation/pages/client/notifications/notifications.component';
import { OwnerApplicationComponent } from '@presentation/pages/client/owner-application/owner-application.component';
import { VenueSearchComponent } from '@presentation/pages/client/venues/venue-search.component';
import { VenueDetailComponent } from '@presentation/pages/client/venues/venue-detail/venue-detail.component';
import { BookingCreateComponent } from '@presentation/pages/client/booking/booking-create.component';
import { BookingHistoryComponent } from '@presentation/pages/client/booking/history/booking-history.component';
import { BookingDetailComponent } from '@presentation/pages/client/booking/detail/booking-detail.component';
import { QrCheckinComponent } from '@presentation/pages/client/booking/checkin/qr-checkin.component';
import { ChatComponent } from '@presentation/pages/client/chat/chat.component';
import { FriendsComponent } from '@presentation/pages/client/friends/friends.component';
import { ClubListComponent } from '@presentation/pages/client/clubs/club-list.component';
import { ClubDetailComponent } from '@presentation/pages/client/clubs/club-detail.component';
import { TournamentListComponent } from '@presentation/pages/client/tournaments/tournament-list.component';
import { TournamentDetailComponent } from '@presentation/pages/client/tournaments/tournament-detail.component';
import { MatchmakingComponent } from '@presentation/pages/client/matchmaking/matchmaking.component';
import { AuthGuard } from '@presentation/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: ClientComponent,
    children: [
      { path: 'home', component: HomeComponent },
      { path: 'venues', component: VenueSearchComponent },
      { path: 'venues/:id', component: VenueDetailComponent },
      { path: 'booking/create', component: BookingCreateComponent, canActivate: [AuthGuard] },
      { path: 'booking/history', component: BookingHistoryComponent, canActivate: [AuthGuard] },
      { path: 'booking/detail/:id', component: BookingDetailComponent, canActivate: [AuthGuard] },
      { path: 'booking/check-in', component: QrCheckinComponent, canActivate: [AuthGuard] },
      { path: 'clubs', component: ClubListComponent },
      { path: 'clubs/:id', component: ClubDetailComponent },
      { path: 'tournaments', component: TournamentListComponent },
      { path: 'tournaments/:id', component: TournamentDetailComponent },
      { path: 'matchmaking', component: MatchmakingComponent, canActivate: [AuthGuard] },
      { path: 'chat', component: ChatComponent, canActivate: [AuthGuard] },
      { path: 'chat/:roomId', component: ChatComponent, canActivate: [AuthGuard] },
      { path: 'friends', component: FriendsComponent, canActivate: [AuthGuard] },
      { path: 'settings', component: SettingsComponent, canActivate: [AuthGuard] },
      { path: 'notifications', component: NotificationsComponent, canActivate: [AuthGuard] },
      { path: 'profile', redirectTo: 'settings', pathMatch: 'full' },
      { path: 'owner-application', component: OwnerApplicationComponent, canActivate: [AuthGuard] },
      { path: '', redirectTo: 'home', pathMatch: 'full' }
    ]
  }
];


@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClientRoutingModule { }
