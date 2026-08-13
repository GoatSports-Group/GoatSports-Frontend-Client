import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClientComponent } from '@shared/layouts/client/client.component';
import { HomeComponent } from '@presentation/pages/client/home/home.component';
import { ProfileComponent } from '@presentation/pages/client/profile/profile.component';
import { OwnerApplicationComponent } from '@presentation/pages/client/owner-application/owner-application.component';
import { AuthGuard } from '@presentation/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: ClientComponent,
    children: [
      { path: 'home', component: HomeComponent },
      { path: 'profile', component: ProfileComponent, canActivate: [AuthGuard] },
      { path: 'owner-application', component: OwnerApplicationComponent },
      { path: '', redirectTo: 'home', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClientRoutingModule { }
