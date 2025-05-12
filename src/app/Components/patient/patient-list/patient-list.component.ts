import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';
import { Patient } from 'src/app/Models/patient.model';
import { PatientDetail } from 'src/app/Models/patientDetail.model';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { PatientDataService } from 'src/app/Services/patient-data.service';
import { PatientService } from 'src/app/Services/patient.service';
import { ShowalertService } from 'src/app/Services/showalert.service';
import { PatientEditComponent } from '../patient-edit/patient-edit.component';
import { IndexedDbService } from 'src/app/Services/indexed-db.service';

@Component({
  selector: 'app-patient-list',
  templateUrl: './patient-list.component.html',
  styleUrls: ['./patient-list.component.css']
})
export class PatientListComponent implements OnInit , AfterViewInit{

  patient: Patient[]=[];
  dataSource: PatientDataService= new PatientDataService(this.patientService);
  displayedColumns:any[] = [];


  tempPatient: PatientDetail={  patientId: 0, firstName: '', lastName: '',drName: '', gender: '', age: 0,
                                maritalStatus: '', dob: new Date(), phone: '', email: '',
                                state: '',  address: ''
                              };


  @ViewChild(MatPaginator) paginator: MatPaginator;
  
  total:number=0;
  isSuperAdmin: boolean = false;

  constructor(private patientService: PatientService,private dialog: MatDialog,
              private intl: MatPaginatorIntl, private changeDetectorRef: ChangeDetectorRef,
              private notifyUpdate: NotifyUpdateService,private indexedDbService:IndexedDbService) {
    
    this.paginator=new MatPaginator(this.intl, this.changeDetectorRef);

    this.notifyUpdate.notify.subscribe(()=>{
        this.dataActions('','asc',0,5);
    });
   }

  ngOnInit(): void {

        this.indexedDbService.getItem<string>('loginUser').then((loginUser) => {
    this.isSuperAdmin = loginUser === 'admin';

    this.displayedColumns = ['patientId', 'name', 'drName', 'gender', 'phone'];

    if (this.isSuperAdmin) {
      this.displayedColumns.push('action');

    }

       this.dataActions('','asc',0,5);

  });
 
  }
  
  ngAfterViewInit(): void {
    this.paginator?.page.subscribe(()=>{
      this.dataActions('','asc',this.paginator.pageIndex,this.paginator.pageSize);      
    });
  }

  dataActions(a: string,b: string, c: number,d: number):void{
    this.dataSource.loadPatient(a,b,c,d);
    this.paginator.pageIndex= c;
    this.paginator.pageSize= d;
    this.total=this.patientService.total;      
  }

  editPatient(id : number){
  this.patientService.getPatientDetails(id).subscribe(data => {
  if (data) {
    this.tempPatient = data;

    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.data = this.tempPatient;

    const dialogRef = this.dialog.open(PatientEditComponent, dialogConfig);

    dialogRef.afterClosed().subscribe((data: PatientDetail) => {
      if (data) {
        const res:any = this.patientService.updatePatient(data);
        const msg = res ? "Patient Data Updated Successfully" : "Something went wrong";
        const type = res ? "success" : "error";

        this.notifyUpdate.notify.next(true);
        this.notifyUpdate.alertNotify.next({ msg, type });
      }
    });
  } else {
    this.notifyUpdate.alertNotify.next({ msg: "Patient not found", type: "error" });
  }
});

  }

  async deletePatient(id: number) {
  const confirmed = confirm('Are you sure you want to delete this patient?');
  if (!confirmed) return;

  const result = await this.patientService.deletePatient(id);
  let msg = 'Failed to delete patient.';
  let type = 'error';

  if (result) {
    msg = 'Patient deleted successfully.';
    type = 'success';
    this.notifyUpdate.notify.next(true); // refresh list
  }

  this.notifyUpdate.alertNotify.next({ msg, type });
}


}
