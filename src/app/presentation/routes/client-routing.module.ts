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
import { PaymentResultComponent } from '@presentation/pages/client/payment/payment-result.component';
import { ChatComponent } from '@presentation/pages/client/chat/chat.component';
import { FriendsComponent } from '@presentation/pages/client/friends/friends.component';
import { ClubListComponent } from '@presentation/pages/client/clubs/club-list.component';
import { ClubDetailComponent } from '@presentation/pages/client/clubs/club-detail.component';
import { TournamentListComponent } from '@presentation/pages/client/tournaments/tournament-list.component';
import { TournamentDetailComponent } from '@presentation/pages/client/tournaments/tournament-detail.component';
import { MatchmakingComponent } from '@presentation/pages/client/matchmaking/matchmaking.component';
import { SocialFeedComponent } from '@presentation/pages/client/feed/social-feed.component';
import { AuthGuard } from '@presentation/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: ClientComponent,
    children: [
      { path: 'home', component: HomeComponent, title: 'Trang chủ | GOAT Sports' },
      { path: 'venues', component: VenueSearchComponent, title: 'Tìm sân đấu | GOAT Sports' },
      { path: 'venues/:id', component: VenueDetailComponent, title: 'Chi tiết sân | GOAT Sports' },
      { path: 'booking/create', component: BookingCreateComponent, canActivate: [AuthGuard], title: 'Đặt sân | GOAT Sports' },
      { path: 'booking/history', component: BookingHistoryComponent, canActivate: [AuthGuard], title: 'Lịch sử đặt sân | GOAT Sports' },
      { path: 'booking/detail/:id', component: BookingDetailComponent, canActivate: [AuthGuard], title: 'Chi tiết đặt sân | GOAT Sports' },
      {
        path: 'payment/success',
        component: PaymentResultComponent,
        canActivate: [AuthGuard],
        data: { paymentResult: 'success' },
        title: 'Thanh toán thành công | GOAT Sports'
      },
      {
        path: 'payment/cancel',
        component: PaymentResultComponent,
        canActivate: [AuthGuard],
        data: { paymentResult: 'cancelled' },
        title: 'Thanh toán đã hủy | GOAT Sports'
      },
      { path: 'my-bookings', redirectTo: 'booking/history', pathMatch: 'full' },
      { path: 'clubs', component: ClubListComponent, title: 'Câu lạc bộ | GOAT Sports' },
      { path: 'clubs/:id', component: ClubDetailComponent, title: 'Chi tiết câu lạc bộ | GOAT Sports' },
      { path: 'tournaments', component: TournamentListComponent, title: 'Giải đấu | GOAT Sports' },
      { path: 'tournaments/:id', component: TournamentDetailComponent, title: 'Chi tiết giải đấu | GOAT Sports' },
      { path: 'matchmaking', component: MatchmakingComponent, canActivate: [AuthGuard], title: 'AI ghép kèo | GOAT Sports' },
      { path: 'feed', component: SocialFeedComponent, canActivate: [AuthGuard], title: 'Bảng tin | GOAT Sports' },
      { path: 'ai-recommendation', redirectTo: 'matchmaking', pathMatch: 'full' },
      { path: 'chat', component: ChatComponent, canActivate: [AuthGuard], title: 'Tin nhắn | GOAT Sports' },
      { path: 'chat/:roomId', component: ChatComponent, canActivate: [AuthGuard], title: 'Cuộc trò chuyện | GOAT Sports' },
      { path: 'friends', component: FriendsComponent, canActivate: [AuthGuard], title: 'Bạn bè | GOAT Sports' },
      { path: 'settings', component: SettingsComponent, canActivate: [AuthGuard], title: 'Cài đặt tài khoản | GOAT Sports' },
      { path: 'notifications', component: NotificationsComponent, canActivate: [AuthGuard], title: 'Thông báo | GOAT Sports' },
      { path: 'profile', redirectTo: 'settings', pathMatch: 'full' },
      { path: 'owner-application', component: OwnerApplicationComponent, canActivate: [AuthGuard], title: 'Đăng ký chủ sân | GOAT Sports' },
      { path: '', redirectTo: 'home', pathMatch: 'full' }
    ]
  }
];


@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClientRoutingModule { }
