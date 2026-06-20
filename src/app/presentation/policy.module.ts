import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@shared/shared.module';
import { PolicyRoutingModule } from '@presentation/routes/policy-routing.module';

import { BookingPolicyComponent } from '@presentation/pages/policy/booking-policy/booking-policy.component';
import { CancellationPolicyComponent } from '@presentation/pages/policy/cancellation-policy/cancellation-policy.component';
import { CourtStandardsComponent } from '@presentation/pages/policy/court-standards/court-standards.component';
import { ContactSupportComponent } from '@presentation/pages/policy/contact-support/contact-support.component';

@NgModule({
  declarations: [
    BookingPolicyComponent,
    CancellationPolicyComponent,
    CourtStandardsComponent,
    ContactSupportComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    PolicyRoutingModule
  ]
})
export class PolicyModule { }
