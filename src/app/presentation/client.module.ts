import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@shared/shared.module';
import { ClientRoutingModule } from './routes/client-routing.module';

import { ClientComponent } from '@presentation/layouts/client.component';
import { HomeComponent } from '@presentation/pages/client/home/home.component';
import { ProfileComponent } from '@presentation/pages/client/profile/profile.component';
import { OwnerApplicationComponent } from '@presentation/pages/client/owner-application/owner-application.component';

@NgModule({
  declarations: [
    ClientComponent,
    HomeComponent,
    ProfileComponent,
    OwnerApplicationComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    ClientRoutingModule
  ]
})
export class ClientModule { }
