import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BookingPolicyComponent } from './pages/booking-policy/booking-policy.component';
import { CancellationPolicyComponent } from './pages/cancellation-policy/cancellation-policy.component';
import { CourtStandardsComponent } from './pages/court-standards/court-standards.component';
import { ContactSupportComponent } from './pages/contact-support/contact-support.component';

const routes: Routes = [
  { path: 'booking-policy', component: BookingPolicyComponent },
  { path: 'cancellation-policy', component: CancellationPolicyComponent },
  { path: 'court-standards', component: CourtStandardsComponent },
  { path: 'contact-support', component: ContactSupportComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PolicyRoutingModule { }
