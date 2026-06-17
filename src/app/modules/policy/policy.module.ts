import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../shared/shared.module';
import { PolicyRoutingModule } from './policy-routing.module';

import { BookingPolicyComponent } from './pages/booking-policy/booking-policy.component';
import { CancellationPolicyComponent } from './pages/cancellation-policy/cancellation-policy.component';
import { CourtStandardsComponent } from './pages/court-standards/court-standards.component';
import { ContactSupportComponent } from './pages/contact-support/contact-support.component';

@NgModule({
  declarations: [
    BookingPolicyComponent,
    CancellationPolicyComponent,
    CourtStandardsComponent,
    ContactSupportComponent
  ],
  imports: [
    CommonModule,
    PolicyRoutingModule,
    SharedModule
  ]
})
export class PolicyModule { }
