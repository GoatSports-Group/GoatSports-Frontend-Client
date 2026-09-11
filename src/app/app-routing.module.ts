import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClientAccessGuard } from '@presentation/guards/client-access.guard';

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./presentation/client.module').then(m => m.ClientModule),
    canActivate: [ClientAccessGuard]
  },
  {
    path: 'policy',
    loadChildren: () => import('./presentation/policy.module').then(m => m.PolicyModule)
  },
  {
    path: '**',
    redirectTo: 'home',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
