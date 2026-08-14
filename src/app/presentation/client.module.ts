import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@shared/shared.module';
import { ClientRoutingModule } from './routes/client-routing.module';

import { ClientComponent } from '@shared/layouts/client/client.component';
import { HomeComponent } from '@presentation/pages/client/home/home.component';
import { SettingsComponent } from '@presentation/pages/client/settings/settings.component';
import { SettingsPlayerTabComponent } from '@presentation/pages/client/settings/tabs/settings-player-tab.component';
import { SettingsPersonalTabComponent } from '@presentation/pages/client/settings/tabs/settings-personal-tab.component';
import { SettingsSecurityTabComponent } from '@presentation/pages/client/settings/tabs/settings-security-tab.component';
import { OwnerApplicationComponent } from '@presentation/pages/client/owner-application/owner-application.component';
import { OwnerApplicationHistoryComponent } from '@presentation/pages/client/owner-application/history/owner-application-history.component';
import { OwnerApplicationFormComponent } from '@presentation/pages/client/owner-application/form/owner-application-form.component';
import { OwnerApplicationStepperComponent } from '@presentation/pages/client/owner-application/step/stepper/owner-application-stepper.component';
import { OwnerRepresentativeStepComponent } from '@presentation/pages/client/owner-application/step/representative/owner-representative-step.component';
import { OwnerBusinessStepComponent } from '@presentation/pages/client/owner-application/step/business/owner-business-step.component';
import { OwnerAddressStepComponent } from '@presentation/pages/client/owner-application/step/address/owner-address-step.component';
import { OwnerDocumentsStepComponent } from '@presentation/pages/client/owner-application/step/documents/owner-documents-step.component';

@NgModule({
  declarations: [
    ClientComponent,
    HomeComponent,
    SettingsComponent,
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
    OwnerDocumentsStepComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    ClientRoutingModule
  ]
})
export class ClientModule { }
