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

  isShowPatients: boolean = true;
  isShowOpdPatients: boolean = false;
  isShowLabSlips: boolean = false;
  isShowOtSlips: boolean = false;
  isShowPrecption = false

  @ViewChild("placeholder", { read: ViewContainerRef }) alertContainer!: ViewContainerRef;
  isShowOtList: boolean = false;
  otPatientId: any;
  isShowPayment: boolean = false;;

  constructor(private dialog: MatDialog, private notifyUpdate: NotifyUpdateService,
    private patientService: PatientService,
    private opdService: OpdService,
    private labService: LabService,
    private showAlert: ShowalertService,
  private route: ActivatedRoute) {

    this.notifyUpdate.alertNotify.subscribe(ob => {
      this.showAlert.showAlert(ob.msg, ob.type, this.alertContainer);
    });

    localStorage.getItem('loginUser')

    const loginUser = localStorage.getItem('loginUser');
    if (loginUser) {
      this.userName = JSON.parse(loginUser);
    } 
  }

  ngOnInit(): void {
    setInterval(() => {
      this.currentDateTime = new Date();
    }, 1000);

    this.route.queryParams.subscribe(params => {
      this.otPatientId = params['patientId'];
      console.log('Received patientId:', this.otPatientId);
      if(this.otPatientId){
        this.isShowOtSlips = true;
        this.isShowOtList = false;
        this.isShowLabSlips = false;
        this.isShowPatients = false;
        this.isShowOpdPatients = false;
        this.isShowPrecption = false
      }
      else{
        this.isShowOtSlips = false;
        this.isShowOtList = true;
        this.isShowLabSlips = false;
        this.isShowPatients = false;
        this.isShowOpdPatients = false;
        this.isShowPrecption = false

      }

    });
  }

  addPatient() {
    this.openDialog(PatientEditComponent, this.tempPatient, this.patientService.addNewPatient.bind(this.patientService));
  }

  addOpdSlip() {
    this.openDialog(OpdEditComponent, this.tempOpd, this.opdService.addNewOpd.bind(this.opdService));
  }

  addLabTestSlip() {
    this.openDialog(LabEditComponent, this.tempLabPatient, this.labService.addNewLabPatient.bind(this.labService));
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
        this.notifyUpdate.notify.next();
        this.notifyUpdate.alertNotify.next({ msg, type });
      }
    });
  }

  showPatientList() {
    this.isShowPatients = true;
    this.isShowOpdPatients = false;
    this.isShowLabSlips = false;
    this.isShowOtSlips = false;
    this.isShowPayment = false;
    this.isShowPrecption = false

  }

  showOpdList() {
    this.isShowOpdPatients = true;
    this.isShowPatients = false;
    this.isShowLabSlips = false;
    this.isShowOtList = false;
    this.isShowOtSlips = false;
    this.isShowPayment = false;
    this.isShowPrecption = false


  }

  showLabTestSlipList() {
    this.isShowLabSlips = true;
    this.isShowPatients = false;
    this.isShowOpdPatients = false;
    this.isShowOtSlips = false;
    this.isShowOtList = false;
    this.isShowPayment = false;
    this.isShowPrecption = false


  }
  showOtSlip(){
    this.isShowOtSlips = true;
    this.isShowOtList = false
    this.isShowLabSlips = false;
    this.isShowPatients = false;
    this.isShowOpdPatients = false;
    this.isShowPayment = false;
    this.isShowPrecption = false


  }

  showOtListSlip() {
    this.isShowOtSlips = false;
    this.isShowLabSlips = false;
    this.isShowPatients = false;
    this.isShowOpdPatients = false;
    this.isShowOtList = true;
    this.isShowPayment = false;
    this.isShowPrecption = false



  }

  showPayment(){
    this.isShowPayment = true;
    this.isShowOtSlips = false;
    this.isShowOtList = false
    this.isShowLabSlips = false;
    this.isShowPatients = false;
    this.isShowOpdPatients = false;
    this.isShowPrecption = false

  }


  close(){
    this.isShowOtList = true;
    this.isShowLabSlips = false;
    this.isShowPatients = false;
    this.isShowOpdPatients = false;
    this.isShowOtSlips = false;
    this.isShowPayment = false;
    this.isShowPrecption = false


  }

  showPreception(){
    this.isShowOtList = false;
    this.isShowLabSlips = false;
    this.isShowPatients = false;
    this.isShowOpdPatients = false;
    this.isShowOtSlips = false;
    this.isShowPayment = false;
    this.isShowPrecption = true
  }

 
}
