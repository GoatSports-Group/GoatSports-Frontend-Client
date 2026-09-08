import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BookingPolicyComponent } from '@presentation/pages/policy/booking-policy/booking-policy.component';
import { CancellationPolicyComponent } from '@presentation/pages/policy/cancellation-policy/cancellation-policy.component';
import { CourtStandardsComponent } from '@presentation/pages/policy/court-standards/court-standards.component';
import { ContactSupportComponent } from '@presentation/pages/policy/contact-support/contact-support.component';

const routes: Routes = [
  { path: 'booking-policy', component: BookingPolicyComponent, title: 'Chính sách đặt sân | GOAT Sports' },
  { path: 'cancellation-policy', component: CancellationPolicyComponent, title: 'Chính sách hủy sân | GOAT Sports' },
  { path: 'court-standards', component: CourtStandardsComponent, title: 'Tiêu chuẩn sân đấu | GOAT Sports' },
  { path: 'contact-support', component: ContactSupportComponent, title: 'Liên hệ hỗ trợ | GOAT Sports' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PolicyRoutingModule { }
