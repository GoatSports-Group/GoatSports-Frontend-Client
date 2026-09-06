import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@shared/shared.module';
import { ClientRoutingModule } from './routes/client-routing.module';

import { ClientComponent } from '@shared/layouts/client/client.component';
import { HomeComponent } from '@presentation/pages/client/home/home.component';
import { SettingsComponent } from '@presentation/pages/client/settings/settings.component';
import { NotificationsComponent } from '@presentation/pages/client/notifications/notifications.component';
import { SettingsPlayerTabComponent } from '@presentation/pages/client/settings/tabs/player/settings-player-tab.component';
import { SettingsPersonalTabComponent } from '@presentation/pages/client/settings/tabs/personal/settings-personal-tab.component';
import { SettingsSecurityTabComponent } from '@presentation/pages/client/settings/tabs/security/settings-security-tab.component';
import { OwnerApplicationComponent } from '@presentation/pages/client/owner-application/owner-application.component';
import { OwnerApplicationHistoryComponent } from '@presentation/pages/client/owner-application/history/owner-application-history.component';
import { OwnerApplicationFormComponent } from '@presentation/pages/client/owner-application/form/owner-application-form.component';
import { OwnerApplicationStepperComponent } from '@presentation/pages/client/owner-application/step/stepper/owner-application-stepper.component';
import { OwnerRepresentativeStepComponent } from '@presentation/pages/client/owner-application/step/representative/owner-representative-step.component';
import { OwnerBusinessStepComponent } from '@presentation/pages/client/owner-application/step/business/owner-business-step.component';
import { OwnerAddressStepComponent } from '@presentation/pages/client/owner-application/step/address/owner-address-step.component';
import { OwnerDocumentsStepComponent } from '@presentation/pages/client/owner-application/step/documents/owner-documents-step.component';
import { VenueSearchComponent } from '@presentation/pages/client/venues/venue-search.component';
import { VenueCardComponent } from '@presentation/pages/client/venues/venue-card/venue-card.component';
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
import { AiAssistantModalComponent } from '@presentation/shared/components/ai-assistant-modal/ai-assistant-modal.component';

@NgModule({
  declarations: [
    ClientComponent,
    HomeComponent,
    SettingsComponent,
    NotificationsComponent,
    SettingsPlayerTabComponent,
    SettingsPersonalTabComponent,
    SettingsSecurityTabComponent,
    OwnerApplicationComponent,
    OwnerApplicationHistoryComponent,
    OwnerApplicationFormComponent,
    OwnerApplicationStepperComponent,
    OwnerRepresentativeStepComponent,
    OwnerBusinessStepComponent,
    OwnerAddressStepComponent,
    OwnerDocumentsStepComponent,
    VenueSearchComponent,
    VenueCardComponent,
    VenueDetailComponent,
    BookingCreateComponent,
    BookingHistoryComponent,
    BookingDetailComponent,
    QrCheckinComponent,
    ChatComponent,
    FriendsComponent,
    ClubListComponent,
    ClubDetailComponent,
    TournamentListComponent,
    TournamentDetailComponent,
    MatchmakingComponent,
    AiAssistantModalComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    ClientRoutingModule
  ]
})
export class ClientModule { }

