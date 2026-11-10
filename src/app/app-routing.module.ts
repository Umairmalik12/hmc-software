import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { HomeComponent } from './Components/home/home.component';
import { LoginComponent } from './Components/login/login.component';
import { AuthGuardService } from './Services/Guard-Services/auth-guard.service';

const routes: Routes = [
  {
    path:'', 
    component: LoginComponent, 
    pathMatch: 'full'
  },
  {
    path:'home', 
    component: HomeComponent,
    canActivate: [AuthGuardService],
    data: { dashboardView: 'patients' }
  },
  {
    path:'patient', 
    component: HomeComponent,
    canActivate: [AuthGuardService],
    data: { dashboardView: 'patients' }
  },
  {
    path:'opd', 
    component: HomeComponent,
    canActivate: [AuthGuardService],
    data: { dashboardView: 'opd' }
  },
  {
    path:'lab', 
    component: HomeComponent,
    canActivate: [AuthGuardService],
    data: { dashboardView: 'lab' }
  },
  {
    path:'medicine', 
    component: HomeComponent,
    canActivate: [AuthGuardService],
    data: { dashboardView: 'medicine' }
  },
  {
    path:'inpatient', 
    component: HomeComponent,
    canActivate: [AuthGuardService],
    data: { dashboardView: 'inpatient' }
  },
  {
    path: 'patient-tokens',
    component: HomeComponent,
    canActivate: [AuthGuardService],
    data: { dashboardView: 'tokens' }
  },
  {
    path:'**',
    redirectTo:''
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
