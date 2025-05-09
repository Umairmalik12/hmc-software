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

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  userName: string = '';
  currentDateTime: Date = new Date();

  tempPatient: PatientDetail = {
    patientId: 0, firstName: '', lastName: '', drName: '', gender: '', age: 0,
    maritalStatus: '', dob: new Date(), phone: '', email: '',
    state: '', address: ''
  };

  tempOpd: Opd = {
    patientId: 0,
    dateTime: '',
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
    amount: 0
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

  isShowPatients = true;
  isShowOpdPatients = false;
  isShowLabSlips = false;
  isShowOtSlips = false;
  isShowPrecption = false;
  isShowOtList = false;
  isShowPayment = false;
  otPatientId: any;

  @ViewChild("placeholder", { read: ViewContainerRef }) alertContainer!: ViewContainerRef;

  constructor(
    private dialog: MatDialog,
    private notifyUpdate: NotifyUpdateService,
    private patientService: PatientService,
    private opdService: OpdService,
    private labService: LabService,
    private showAlert: ShowalertService,
    private route: ActivatedRoute,
    private dbService: IndexedDbService
  ) {
    this.notifyUpdate.alertNotify.subscribe(ob => {
      this.showAlert.showAlert(ob.msg, ob.type, this.alertContainer);
    });
  }

  async ngOnInit(): Promise<void> {
    setInterval(() => {
      this.currentDateTime = new Date();
    }, 1000);

    const loginUser = await this.dbService.getItem<string>('loginUser');
    if (loginUser) {
      this.userName = loginUser;
    }

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

  openDialog(component: any, data: any, serviceMethod: (data: any) => boolean) {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.data = data;

    const dialogRef = this.dialog.open(component, dialogConfig);

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result) {
        let res = serviceMethod(result);
        let msg = res ? "Operation Successful" : "Something went wrong";
        let type = res ? "success" : "error";
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

  close() {
    this.resetViews();
    this.isShowOtList = true;
  }

  private resetViews() {
    this.isShowPatients = false;
    this.isShowOpdPatients = false;
    this.isShowLabSlips = false;
    this.isShowOtSlips = false;
    this.isShowOtList = false;
    this.isShowPayment = false;
    this.isShowPrecption = false;
  }

  addPatient() {
    this.openDialog(PatientEditComponent, this.tempPatient, this.patientService.addNewPatient.bind(this.patientService));
  }

  addOpdSlip() {
    this.openDialog(OpdEditComponent, this.tempOpd, this.opdService.addNewOpd.bind(this.opdService));
  }

  addLabTestSlip() {
    this.openDialog(
      LabEditComponent,
      this.tempLabPatient,
      (patientData: LabPatient) => {
        this.labService.addNewLabPatient(patientData).subscribe({
          next: (success) => {
            if (success) {
              console.log('Patient added successfully');
            }
            return success;  
          },
          error: (err) => {
            console.error('Error adding patient:', err);
            return false;
          }
        });
        return true; 
      }
    );
  }

}
