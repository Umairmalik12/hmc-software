import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';
import { PatientDetail } from 'src/app/Models/patientDetail.model';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { LabEditComponent } from '../lab-edit/lab-edit.component';
import { LabPatientDataService } from 'src/app/Services/lab-data.service';
import { LabService } from 'src/app/Services/lab.service';
import { LabPatient } from 'src/app/Models/lab.model';
import { IndexedDbService } from 'src/app/Services/indexed-db.service';

@Component({
  selector: 'app-lab-list',
  templateUrl: './lab-list.component.html',
  styleUrls: ['./lab-list.component.css']
})
export class LabListComponent implements OnInit, AfterViewInit {

  patient: LabPatient[] = [];
  dataSource: LabPatientDataService = new LabPatientDataService(this.labService);
  displayedColumns: string[] = [];


  tempLabPatient: LabPatient = {
    patientId: 0,
    price: 0,
    suggestedDr: '',
    dateTime: new Date(),
    name: '',
    phone: '',
    testName: '',
  };


  @ViewChild(MatPaginator) paginator: MatPaginator;

  total: number = 0;
  isSuperAdmin: boolean = false;

  constructor(private labService: LabService, private dialog: MatDialog,
    private intl: MatPaginatorIntl, private changeDetectorRef: ChangeDetectorRef,
    private indexDb: IndexedDbService,
    private notifyUpdate: NotifyUpdateService) {

    this.paginator = new MatPaginator(this.intl, this.changeDetectorRef);

    this.notifyUpdate.notify.subscribe(() => {
      this.dataActions('', 'asc', 0, 5);
    });
  }

ngOnInit(): void {
  this.indexDb.getItem<string>('loginUser').then((loginUser) => {
    this.isSuperAdmin = loginUser === 'admin';

    this.displayedColumns = ['patientId', 'name', 'testName', 'price', 'suggestedDr', 'dateTime'];

    if (this.isSuperAdmin) {
      this.displayedColumns.push('action');
    }

    // Now safe to call data
    this.dataActions('', 'asc', 0, 5);
  });
}

  ngAfterViewInit(): void {
    this.paginator.page.subscribe(() => {
      this.dataActions('', 'asc', this.paginator.pageIndex, this.paginator.pageSize);
    });
  }

  dataActions(a: string, b: string, c: number, d: number): void {
    this.dataSource.loadLabPatient(a, b, c, d);
    this.paginator.pageIndex = c;
    this.paginator.pageSize = d;
    this.total = this.labService.total;
  }

 editLabPatient(id: number) {
  this.labService.getLabPatientDetails(id).subscribe(data => {
    this.tempLabPatient = data;

    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.data = {...data};

    const dialogRef = this.dialog.open(LabEditComponent, dialogConfig);

    dialogRef.afterClosed().subscribe((data: LabPatient) => {
      if (data) {
        console.log("data",data)
        this.labService.updateLabPatient(data).subscribe(success => {
          let msg = " Something went wrong";
          let type = "error";
          if (success) {
            this.notifyUpdate.notify.next(true);
            msg = "Lab Patient Data Updated Successfully";
            type = "success";
          }
          this.notifyUpdate.alertNotify.next({ msg, type });
        });
      }
    });
  });
}


  deleteLabPatient(id: number): void {
  if (confirm('Are you sure you want to delete this lab patient?')) {
    this.labService.deleteLabPatient(id).subscribe({
      next: (success:any) => {
        if (success) {
          this.notifyUpdate.notify.next(true);
          this.notifyUpdate.alertNotify.next({
            msg: 'Lab Patient deleted successfully',
            type: 'success'
          });
        } else {
          this.notifyUpdate.alertNotify.next({
            msg: 'Failed to delete patient',
            type: 'error'
          });
        }
      },
      error: () => {
        this.notifyUpdate.alertNotify.next({
          msg: 'An error occurred during deletion',
          type: 'error'
        });
      }
    });
  }
}
}
