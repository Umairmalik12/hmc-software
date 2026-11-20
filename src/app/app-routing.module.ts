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
  { path: 'ot-medicines', component: HomeComponent, canActivate: [AuthGuardService], data: { dashboardView: 'ot-medicine-catalog' } },
  { path: 'ot-records', component: HomeComponent, canActivate: [AuthGuardService], data: { dashboardView: 'ot-list' } },
  { path: 'ot-slip', component: HomeComponent, canActivate: [AuthGuardService], data: { dashboardView: 'ot-form' } },
  { path: 'payments', component: HomeComponent, canActivate: [AuthGuardService], data: { dashboardView: 'payment' } },
  { path: 'staff', component: HomeComponent, canActivate: [AuthGuardService], data: { dashboardView: 'staff' } },
  { path: 'expenses', component: HomeComponent, canActivate: [AuthGuardService], data: { dashboardView: 'expenses' } },
  { path: 'doctors', component: HomeComponent, canActivate: [AuthGuardService], data: { dashboardView: 'doctors' } },
  { path: 'lab-tests', component: HomeComponent, canActivate: [AuthGuardService], data: { dashboardView: 'lab-test-catalog' } },
  { path: 'procedures', component: HomeComponent, canActivate: [AuthGuardService], data: { dashboardView: 'procedures' } },
  { path: 'rooms', component: HomeComponent, canActivate: [AuthGuardService], data: { dashboardView: 'rooms' } },
  { path: 'prescription-medicines', component: HomeComponent, canActivate: [AuthGuardService], data: { dashboardView: 'medicine-catalog' } },
  { path: 'prescriptions/new', component: HomeComponent, canActivate: [AuthGuardService], data: { dashboardView: 'prescription' } },
  { path: 'prescriptions/:prescriptionId/edit', component: HomeComponent, canActivate: [AuthGuardService], data: { dashboardView: 'prescription' } },
  { path: 'prescriptions', component: HomeComponent, canActivate: [AuthGuardService], data: { dashboardView: 'prescription-list' } },
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
