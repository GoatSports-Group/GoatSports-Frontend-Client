import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../shared/shared.module';
import { PolicyRoutingModule } from './routes/policy-routing.module';

import { BookingPolicyComponent } from './pages/policy/booking-policy/booking-policy.component';
import { CancellationPolicyComponent } from './pages/policy/cancellation-policy/cancellation-policy.component';
import { CourtStandardsComponent } from './pages/policy/court-standards/court-standards.component';
import { ContactSupportComponent } from './pages/policy/contact-support/contact-support.component';

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
