import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@shared/shared.module';
import { ClientRoutingModule } from './routes/client-routing.module';

import { ClientComponent } from '@shared/layouts/client/client.component';
import { HomeComponent } from '@presentation/pages/client/home/home.component';
import { ProfileComponent } from '@presentation/pages/client/profile/profile.component';
import { ProfileInfoComponent } from '@presentation/pages/client/profile/info/profile-info.component';
import { ProfileSettingsComponent } from '@presentation/pages/client/profile/settings/profile-settings.component';
import { ProfileSecurityComponent } from '@presentation/pages/client/profile/security/profile-security.component';
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
    ProfileComponent,
    ProfileInfoComponent,
    ProfileSettingsComponent,
    ProfileSecurityComponent,
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
