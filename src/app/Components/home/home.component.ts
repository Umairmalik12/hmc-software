import { Component, HostListener, OnDestroy, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { PatientDetail } from 'src/app/Models/patientDetail.model';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { PatientService } from 'src/app/Services/patient.service';
import { ShowalertService } from 'src/app/Services/showalert.service';
import { PatientEditComponent } from '../patient/patient-edit/patient-edit.component';
import { OpdEditComponent } from '../opdslip/opd-edit/opd-edit.component';
import { OpdService } from 'src/app/Services/opd.service';
import { Opd } from 'src/app/Models/opd.model';
import { LabEditComponent } from '../lab/lab-edit/lab-edit.component';
import { LabPatient } from 'src/app/Models/lab.model';
import { LabService } from 'src/app/Services/lab.service';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { UserLoginService } from 'src/app/Services/user-login.service';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';
import { combineLatest, Subscription } from 'rxjs';
import { InpatientEditComponent } from '../inpatient/inpatient-edit/inpatient-edit.component';
import { InpatientService } from 'src/app/Services/inpatient.service';
import { Medicine } from 'src/app/Models/medicine.model';
import { MedicineService } from 'src/app/Services/medicine.service';
import { MedicineEditComponent } from '../medicine/medicine-edit/medicine-edit.component';
import { InPatient } from 'src/app/Models/inpatient.model';
import { AdminAssistantComponent } from '../admin-assistant/admin-assistant.component';
import { ModulePermissionService } from 'src/app/Services/module-permission.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  userName: string = '';
  currentDateTime: Date = new Date();

  otPatientId = '';
  prescriptionId: string | null = null;
  opdVisitId: string | null = null;
  isShowDoctors = false;
  isShowStaff = false;
  isShowTeamAccounts = false;
  isShowPermissions = false;
  teamSignup = false;
  isShowExpenses = false;
  isShowLabTestCatalog = false;
  isShowProcedures = false;
  isShowRooms = false;
  isShowMedicineCatalog = false;
  isShowOtMedicineCatalog = false;
  isShowOtList = false;
  isShowPayment = false;
  isShowPrecption = false;
  isShowPrescriptionList = false;
  isShowMedicine = false;
  isShowPatientTokens = false;
  isMobile = window.innerWidth <= 760;
  isMobileNavOpen = false;

  tempPatient: PatientDetail = {
    patientId: 0, firstName: '', lastName: '', drName: '', gender: '', age: 0,
    maritalStatus: '', phone: '',
    city: '', address: '', procedure: '', createdAt: ''
  };

  tempMedicine: Medicine = {
    medicineId: 0,
    roomNo: '',
    patientName: '',
    medicines: [],
    doctorName: '',
    createdAt: ''
  };

  tempOpd: Opd = {
    patientId: 0,
    date: '',
    time: '',
    patientName: '',
    age: 0,
    sex: '',
    bp: '',
    temp: '',
    weight: '',
    phone: '',
    address: '',
    history: '',
    drName: '',
    followUp: '',
    patientCategory: '',
    amount: 0,
    createdAt: ''
  };

  tempLabPatient: LabPatient = {
    patientId: 0,
    price: 0,
    suggestedDr: '',
    dateTime: '',
    name: '',
    phone: '',
    testName: '',
  };

  tempInnPatient: any = {
    inpatientId: 0,
    patientName: '',
    procedure: '',
    admissionDate: '',
    dischargeDate: '',
    surgeonName: ''
  };

  isShowPatients = true;
  isShowOpdPatients = false;
  isShowLabSlips = false;
  isShowOtSlips = false;
  isShowInnPatients = false;

  isSuperAdmin: boolean = false;
  private roleLoaded = false;
  private realtimeSubscription?: Subscription;
  private subscriptions = new Subscription();
  private clockTimer?: ReturnType<typeof setInterval>;

  openAssistant(): void {
    if (!this.isSuperAdmin || this.dialog.openDialogs.some(dialog => dialog.componentInstance instanceof AdminAssistantComponent)) return;
    this.dialog.open(AdminAssistantComponent, { width: 'min(720px, calc(100vw - 28px))', maxWidth: '96vw', maxHeight: '92dvh', panelClass: 'hmc-dialog-panel', autoFocus: 'first-heading', closeOnNavigation: true });
  }

  @ViewChild("placeholder", { read: ViewContainerRef }) alertContainer!: ViewContainerRef;

  constructor(
    private dialog: MatDialog,
    private notifyUpdate: NotifyUpdateService,
    private patientService: PatientService,
    private opdService: OpdService,
    private labService: LabService,
    private inpatientService: InpatientService,
    private medicineService: MedicineService,
    private showAlert: ShowalertService,
    private route: ActivatedRoute,
    private router: Router,
    private dataService: SupabaseDataService,
    private userLogin: UserLoginService,
    private permissions: ModulePermissionService
  ) {
  }

  async ngOnInit(): Promise<void> {
    this.subscriptions.add(this.permissions.changes.subscribe(() => {
      this.isSuperAdmin = this.permissions.isAdmin;
      const role = this.permissions.currentRole;
      this.userName = this.isSuperAdmin ? 'Administrator' : (role === 'staff' ? 'Staff' : role || 'Loading account...');
      if (this.roleLoaded) this.checkPrescriptionAccess();
    }));
    void this.permissions.load().then(() => {
        this.roleLoaded = true;
        this.checkPrescriptionAccess();
    }).catch(error => {
        this.roleLoaded = true;
        this.userName = 'Account unavailable';
        this.notifyUpdate.error(error instanceof Error ? error.message : 'Module permissions could not be loaded.');
    });
    this.clockTimer = setInterval(() => {
      this.currentDateTime = new Date();
    }, 1000);
    this.realtimeSubscription = this.dataService.changes.subscribe(() => {
      this.notifyUpdate.notify.next(true);
    });

    this.subscriptions.add(combineLatest([this.route.data, this.route.queryParams, this.route.paramMap]).subscribe(([data, params, routeParams]) => {
      this.otPatientId = String(params['patientId'] || '');
      this.prescriptionId = routeParams.get('prescriptionId');
      this.opdVisitId = params['opdVisitId'] ? String(params['opdVisitId']) : null;
      if (this.roleLoaded && this.permissions.currentRole && data['dashboardView'] === 'prescription' && !this.permissions.can('prescriptions', routeParams.get('prescriptionId') ? 'edit' : 'create')) {
        void this.router.navigate(['/prescriptions']);
        return;
      }
      this.selectDashboardView(this.otPatientId ? 'ot-form' : data['dashboardView'] || 'patients');
    }));
  }

  private checkPrescriptionAccess(): void {
    // Wait for a verified role when authentication restarts a pending lookup.
    if (!this.permissions.currentRole || this.route.snapshot.data['dashboardView'] !== 'prescription') return;
    const action = this.route.snapshot.paramMap.get('prescriptionId') ? 'edit' : 'create';
    if (!this.permissions.can('prescriptions', action)) void this.router.navigate(['/prescriptions']);
  }

  ngOnDestroy(): void {
    this.realtimeSubscription?.unsubscribe();
    this.subscriptions.unsubscribe();
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
  }

  openDialog(component: any, data: any, serviceMethod: (data: any) => Promise<boolean> | boolean | void, destination: string) {
    const names: Record<string, string> = { patient: 'Operation patient', opd: 'OPD visit', lab: 'Lab test', inpatient: 'Inpatient', medicine: 'Daily medicine record' };
    const entity = names[destination] || 'Record';
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.data = { ...data };
    dialogConfig.panelClass = 'hmc-dialog-panel';

    const dialogRef = this.dialog.open(component, dialogConfig);

    dialogRef.afterClosed().subscribe(async (result: any) => {
      if (result) {
        try {
          const saved = await serviceMethod(result);
          if (saved === false) {
            this.notifyUpdate.alertNotify.next({
              msg: entity + ' could not be saved. Check your entries and connection, then try again.',
              type: 'error'
            });
            return;
          }

          await this.router.navigate(['/' + destination]);
          this.notifyUpdate.notify.next(true);
          if (destination !== 'medicine') this.notifyUpdate.success(entity + ' created successfully.', { route: '/' + destination });
        } catch (error) {
          console.error('Unable to save dialog record:', error);
          this.notifyUpdate.alertNotify.next({
            msg: entity + ' could not be saved. Please try again.',
            type: 'error'
          });
        }
      }
    });
  }

  async logout(): Promise<void> {
    try {
      await this.userLogin.SignOut();
      await this.router.navigate(['']);
      this.notifyUpdate.success('Signed out successfully.', { title: 'Signed out', route: '/' });
    } catch (error) {
      console.error('Unable to sign out:', error);
      this.notifyUpdate.alertNotify.next({ msg: 'Unable to sign out. Please try again.', type: 'error' });
    }
  }

  showPatientList() {
    void this.router.navigate(['/patient']);
  }

  showOpdList() {
    void this.router.navigate(['/opd']);
  }

  showLabTestSlipList() {
    void this.router.navigate(['/lab']);
  }

  showInnPatientList() {
    void this.router.navigate(['/inpatient']);
  }

  showOtSlip() {
    void this.router.navigate(['/ot-slip']);
  }

  showOtListSlip() {
    void this.router.navigate(['/ot-records']);
  }

  showPayment() {
    void this.router.navigate(['/payments']);
  }

  showPreception() {
    void this.router.navigate(['/prescriptions']);
  }

  showMedicineList() {
    void this.router.navigate(['/medicine']);
  }

  private selectDashboardView(view: string): void {
    this.resetViews();
    switch (view) {
      case 'team-accounts':
      case 'team-signup':
        this.isShowTeamAccounts = true;
        this.teamSignup = view === 'team-signup';
        break;
      case 'permissions':
        this.isShowPermissions = true;
        break;
      case 'opd':
        this.isShowOpdPatients = true;
        break;
      case 'lab':
        this.isShowLabSlips = true;
        break;
      case 'medicine':
        this.isShowMedicine = true;
        break;
      case 'inpatient':
        this.isShowInnPatients = true;
        break;
      case 'tokens':
        this.isShowPatientTokens = true;
        break;
      case 'ot-list':
        this.isShowOtList = true;
        break;
      case 'ot-form':
        this.isShowOtSlips = true;
        break;
      case 'payment':
        this.isShowPayment = true;
        break;
      case 'prescription':
        this.isShowPrecption = true;
        break;
      case 'prescription-list':
        this.isShowPrescriptionList = true;
        break;
      case 'doctors':
        this.isShowDoctors = true;
        break;
      case 'staff':
        this.isShowStaff = true;
        break;
      case 'expenses':
        this.isShowExpenses = true;
        break;
      case 'lab-test-catalog':
        this.isShowLabTestCatalog = true;
        break;
      case 'procedures':
        this.isShowProcedures = true;
        break;
      case 'rooms':
        this.isShowRooms = true;
        break;
      case 'ot-medicine-catalog':
        this.isShowOtMedicineCatalog = true;
        break;
      case 'medicine-catalog':
        this.isShowMedicineCatalog = true;
        break;
      default:
        this.isShowPatients = true;
        break;
    }
  }

  closeMobileNav(): void {
    if (this.isMobile) {
      this.isMobileNavOpen = false;
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile = window.innerWidth <= 760;
    if (!this.isMobile) this.isMobileNavOpen = false;
  }

  close() {
    void this.router.navigate(['/ot-records']);
  }

  private resetViews() {
    this.isShowTeamAccounts = false;
    this.isShowPermissions = false;
    this.teamSignup = false;
    this.isShowPatients = false;
    this.isShowOpdPatients = false;
    this.isShowLabSlips = false;
    this.isShowOtSlips = false;
    this.isShowInnPatients = false;
    this.isShowMedicine = false;
    this.isShowOtList = false;
    this.isShowPayment = false;
    this.isShowPrecption = false;
    this.isShowPrescriptionList = false;
    this.isShowDoctors = false;
    this.isShowStaff = false;
    this.isShowExpenses = false;
    this.isShowLabTestCatalog = false;
    this.isShowProcedures = false;
    this.isShowRooms = false;
    this.isShowMedicineCatalog = false;
    this.isShowOtMedicineCatalog = false;
    this.isShowPatientTokens = false;
  }

  addPatient() {
    this.openDialog(PatientEditComponent, this.tempPatient, (patientData: any) => {
      return this.patientService.addNewPatient(patientData);
    }, 'patient');
  }

  addMedicine() {
    // This dialog persists its own record; do not save it a second time.
    this.openDialog(MedicineEditComponent, { medicines: [] }, () => true, 'medicine');
  }

  addOpdSlip() {
    this.openDialog(OpdEditComponent, this.tempOpd, (opdPatientData: Opd) => {
      return this.opdService.addNewOpd(opdPatientData);
    }, 'opd');
  }

  addLabTestSlip() {
    this.openDialog(LabEditComponent, { ...this.tempLabPatient, dateTime: '' }, (patientData: LabPatient) => {
      return this.labService.addNewLabPatient(patientData);
    }, 'lab');
  }

  addInnPatient() {
    this.openDialog(InpatientEditComponent, this.tempInnPatient, (innPatientData: any) => {
      return this.inpatientService.addNewInpatient(innPatientData);
    }, 'inpatient');
  }
}
