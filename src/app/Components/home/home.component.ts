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

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  userName: string = '';
  currentDateTime: Date = new Date();

  otPatientId = '';
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
    createdAt: new Date().toISOString()
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
    dateTime: new Date(),
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
  private realtimeSubscription?: Subscription;
  private subscriptions = new Subscription();
  private clockTimer?: ReturnType<typeof setInterval>;

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
    private userLogin: UserLoginService
  ) {
  }

  async ngOnInit(): Promise<void> {
    this.userLogin.getLoginUser().then((loginUser) => {
      this.isSuperAdmin = loginUser === 'admin';
      this.userName = this.isSuperAdmin ? 'Administrator' : 'Staff';
    }).catch(error => {
      console.error('Unable to load current user role:', error);
      this.notifyUpdate.alertNotify.next({ msg: 'Unable to load your account permissions.', type: 'error' });
    });
    this.clockTimer = setInterval(() => {
      this.currentDateTime = new Date();
    }, 1000);
    this.realtimeSubscription = this.dataService.changes.subscribe(() => {
      this.notifyUpdate.notify.next(true);
    });

    this.subscriptions.add(combineLatest([this.route.data, this.route.queryParams]).subscribe(([data, params]) => {
      this.otPatientId = String(params['patientId'] || '');
      this.selectDashboardView(this.otPatientId ? 'ot-form' : data['dashboardView'] || 'patients');
    }));
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
          this.notifyUpdate.alertNotify.next({ msg: entity + ' created successfully.', type: 'success' });
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
    this.openDialog(LabEditComponent, { ...this.tempLabPatient, dateTime: new Date() }, (patientData: LabPatient) => {
      return this.labService.addNewLabPatient(patientData);
    }, 'lab');
  }

  addInnPatient() {
    this.openDialog(InpatientEditComponent, this.tempInnPatient, (innPatientData: any) => {
      return this.inpatientService.addNewInpatient(innPatientData);
    }, 'inpatient');
  }
}
