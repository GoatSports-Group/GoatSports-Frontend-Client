import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@shared/shared.module';
import { ClientRoutingModule } from './routes/client-routing.module';

import { ClientComponent } from '@shared/layouts/client/client.component';
import { HomeComponent } from '@presentation/pages/client/home/home.component';
import { SettingsComponent } from '@presentation/pages/client/settings/settings.component';
import { NotificationsComponent } from '@presentation/pages/client/notifications/notifications.component';
import { SettingsPersonalTabComponent } from '@presentation/pages/client/settings/tabs/personal/settings-personal-tab.component';
import { SettingsSecurityTabComponent } from '@presentation/pages/client/settings/tabs/security/settings-security-tab.component';
import { SettingsSportsTabComponent } from '@presentation/pages/client/settings/tabs/sports/settings-sports-tab.component';
import { SettingsBankingTabComponent } from '@presentation/pages/client/settings/tabs/banking/settings-banking-tab.component';
import { VenueSearchComponent } from '@presentation/pages/client/venues/venue-search.component';
import { VenueCardComponent } from '@presentation/pages/client/venues/venue-card/venue-card.component';
import { VenueDetailComponent } from '@presentation/pages/client/venues/venue-detail/venue-detail.component';
import { VenueFacilityLayoutViewComponent } from '@presentation/pages/client/venues/venue-detail/venue-facility-layout-view.component';
import { BookingCreateComponent } from '@presentation/pages/client/booking/booking-create.component';
import { BookingHistoryComponent } from '@presentation/pages/client/booking/history/booking-history.component';
import { BookingDetailComponent } from '@presentation/pages/client/booking/detail/booking-detail.component';
import { QrCheckinComponent } from '@presentation/pages/client/booking/checkin/qr-checkin.component';
import { PaymentResultComponent } from '@presentation/pages/client/payment/payment-result.component';
import { ChatComponent } from '@presentation/pages/client/chat/chat.component';
import { FriendsComponent } from '@presentation/pages/client/friends/friends.component';
import { ClubListComponent } from '@presentation/pages/client/clubs/club-list.component';
import { ClubDetailComponent } from '@presentation/pages/client/clubs/club-detail.component';
import { ClubFeaturedComponent } from '@presentation/pages/client/clubs/club-featured.component';
import { ClubExploreComponent } from '@presentation/pages/client/clubs/club-explore.component';
import { ClubJoinRequestModalComponent } from '@presentation/pages/client/clubs/club-join-request-modal.component';
import { MyClubsComponent } from '@presentation/pages/client/clubs/my-clubs.component';
import { MyClubCardComponent } from '@presentation/pages/client/clubs/my-club-card.component';
import { MyClubRoleBadgeComponent } from '@presentation/pages/client/clubs/my-club-role-badge.component';
import { MyClubsEmptyStateComponent } from '@presentation/pages/client/clubs/my-clubs-empty-state.component';
import { ClubMemberWorkspaceComponent } from '@presentation/pages/client/clubs/club-member-workspace.component';
import { ClubPlayerSearchComponent } from '@presentation/pages/client/clubs/club-player-search.component';
import { ClubTagEditorComponent } from '@presentation/pages/client/clubs/club-tag-editor.component';
import { TournamentListComponent } from '@presentation/pages/client/tournaments/tournament-list.component';
import { TournamentDetailComponent } from '@presentation/pages/client/tournaments/tournament-detail.component';
import { MatchmakingComponent } from '@presentation/pages/client/matchmaking/matchmaking.component';
import { SocialFeedComponent } from '@presentation/pages/client/feed/social-feed.component';
import { AiAssistantModalComponent } from '@presentation/shared/components/ai-assistant-modal/ai-assistant-modal.component';

@NgModule({
  declarations: [
    ClientComponent,
    HomeComponent,
    SettingsComponent,
    NotificationsComponent,
    SettingsPersonalTabComponent,
    SettingsSecurityTabComponent,
    SettingsSportsTabComponent,
    SettingsBankingTabComponent,
    VenueSearchComponent,
    VenueCardComponent,
    VenueDetailComponent,
    BookingCreateComponent,
    BookingHistoryComponent,
    BookingDetailComponent,
    QrCheckinComponent,
    PaymentResultComponent,
    ChatComponent,
    FriendsComponent,
    ClubListComponent,
    ClubDetailComponent,
    ClubFeaturedComponent,
    ClubExploreComponent,
    ClubJoinRequestModalComponent,
    MyClubsComponent,
    MyClubCardComponent,
    MyClubRoleBadgeComponent,
    MyClubsEmptyStateComponent,
    ClubMemberWorkspaceComponent,
    ClubPlayerSearchComponent,
    ClubTagEditorComponent,
    TournamentListComponent,
    TournamentDetailComponent,
    MatchmakingComponent,
    SocialFeedComponent,
    AiAssistantModalComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    VenueFacilityLayoutViewComponent,
    ClientRoutingModule
  ]
})
export class ClientModule { }
