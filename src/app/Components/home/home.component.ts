import { Component, OnDestroy, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
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
import { Subscription } from 'rxjs';
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

  otPatientId: number = 0;
  isShowOtList = false;
  isShowPayment = false;
  isShowPrecption = false;
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
    this.notifyUpdate.alertNotify.subscribe(ob => {
      this.showAlert.showAlert(ob.msg, ob.type, this.alertContainer);
    });
  }

  async ngOnInit(): Promise<void> {
    this.userLogin.getLoginUser().then((loginUser) => {
      this.isSuperAdmin = loginUser === 'admin';
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

    this.route.data.subscribe(data => {
      this.selectDashboardView(data['dashboardView'] || 'patients');
      if (this.otPatientId) {
        this.isShowOtSlips = true;
      }
    });
    this.route.queryParams.subscribe(params => {
      this.otPatientId = Number(params['patientId']) || 0;
      if (this.otPatientId) {
        this.selectDashboardView('ot-form');
      } else {
        this.selectDashboardView(this.route.snapshot.data['dashboardView'] || 'patients');
      }
    });
  }

  ngOnDestroy(): void {
    this.realtimeSubscription?.unsubscribe();
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
  }

  openDialog(component: any, data: any, serviceMethod: (data: any) => Promise<boolean> | boolean | void) {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.data = data;
    dialogConfig.panelClass = 'hmc-dialog-panel';

    const dialogRef = this.dialog.open(component, dialogConfig);

    dialogRef.afterClosed().subscribe(async (result: any) => {
      if (result) {
        try {
          const saved = await serviceMethod(result);
          if (saved === false) {
            this.notifyUpdate.alertNotify.next({
              msg: 'The record was not saved. Check for a duplicate ID and try again.',
              type: 'error'
            });
            return;
          }

          this.notifyUpdate.notify.next(true);
          this.notifyUpdate.alertNotify.next({ msg: 'Operation successful.', type: 'success' });
        } catch (error) {
          console.error('Unable to save dialog record:', error);
          this.notifyUpdate.alertNotify.next({
            msg: 'Unable to save the record. Please try again.',
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
    this.resetViews();
    this.isShowPatients = true;
  }

  showOpdList() {
    this.resetViews();
    this.isShowOpdPatients = true;
  }

  showLabTestSlipList() {
    this.resetViews();
    this.isShowLabSlips = true;
  }

  showInnPatientList() {
    this.resetViews();
    this.isShowInnPatients = true;
  }

  showOtSlip() {
    this.resetViews();
    this.isShowOtSlips = true;
  }

  showOtListSlip() {
    this.resetViews();
    this.isShowOtList = true;
  }

  showPayment() {
    this.resetViews();
    this.isShowPayment = true;
  }

  showPreception() {
    this.resetViews();
    this.isShowPrecption = true;
  }

  showMedicineList() {
    this.resetViews();
    this.isShowMedicine = true;
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

  close() {
    this.resetViews();
    this.isShowOtList = true;
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
    this.isShowPatientTokens = false;
  }

  addPatient() {
    this.openDialog(PatientEditComponent, this.tempPatient, (patientData: any) => {
      return this.patientService.addNewPatient(patientData);
    });
  }

  addMedicine() {
    this.openDialog(MedicineEditComponent, this.tempMedicine, (medicineData: Medicine) => {
      return this.medicineService.addNewMedicine(medicineData);
    });
  }

  addOpdSlip() {
    this.openDialog(OpdEditComponent, this.tempOpd, (opdPatientData: Opd) => {
      return this.opdService.addNewOpd(opdPatientData);
    });
  }

  addLabTestSlip() {
    this.openDialog(LabEditComponent, this.tempLabPatient, (patientData: LabPatient) => {
      this.labService.addNewLabPatient(patientData);
      return true;
    });
  }

  addInnPatient() {
    this.openDialog(InpatientEditComponent, this.tempInnPatient, (innPatientData: any) => {
      return this.inpatientService.addNewInpatient(innPatientData);
    });
  }
}
