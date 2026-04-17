import { Component, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
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
import { IndexedDbService } from 'src/app/Services/indexed-db.service';
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
export class HomeComponent implements OnInit {
  userName: string = '';
  currentDateTime: Date = new Date();

  otPatientId: number = 0;
  isShowOtList = false;
  isShowPayment = false;
  isShowPrecption = false;
  isShowMedicine = false;

  tempPatient: PatientDetail = {
    patientId: 0, firstName: '', lastName: '', drName: '', gender: '', age: 0,
    maritalStatus: '', phone: '',
    city: '', address: '', procedure: '', createdAt: ''
  };

  tempMedicine: Medicine = {
    medicineId: 0,
  
    roomNo: '',
    patientName: '',
    medicineName: '',
    quantity: 0,
    dosage: '',
    doctorName: '',
    notes: '',
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
    private dbService: IndexedDbService
  ) {
    this.notifyUpdate.alertNotify.subscribe(ob => {
      this.showAlert.showAlert(ob.msg, ob.type, this.alertContainer);
    });
  }

  async ngOnInit(): Promise<void> {
    this.dbService.getItem<string>('loginUser').then((loginUser) => {
      this.isSuperAdmin = loginUser === 'admin';
    });
    setInterval(() => {
      this.currentDateTime = new Date();
    }, 1000);

    this.route.queryParams.subscribe(params => {
      this.otPatientId = params['patientId'];
      if (this.otPatientId) {
        this.isShowOtSlips = true;
        this.isShowOtList = false;
        this.isShowLabSlips = false;
        this.isShowPatients = false;
        this.isShowOpdPatients = false;
        this.isShowPrecption = false;
      } else {
        this.isShowOtSlips = false;
        this.isShowOtList = true;
        this.isShowLabSlips = false;
        this.isShowPatients = false;
        this.isShowOpdPatients = false;
        this.isShowPrecption = false;
      }
    });
  }

  openDialog(component: any, data: any, serviceMethod: (data: any) => any) {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.data = data;

    const dialogRef = this.dialog.open(component, dialogConfig);

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result) {
        const res = serviceMethod(result);
        let msg = "Operation Successful";
        let type = "success";
        this.notifyUpdate.notify.next(true);
        this.notifyUpdate.alertNotify.next({ msg, type });
      }
    });
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
