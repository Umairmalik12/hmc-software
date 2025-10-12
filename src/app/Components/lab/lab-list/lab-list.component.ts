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

printLabSlip(patientId: string): void {
  // Get current lab data safely from BehaviorSubject
  const labs = this.dataSource['labSubject'].getValue(); // Direct access to BehaviorSubject value

  const lab = labs.find(item => String(item.patientId) === String(patientId));
  if (!lab) {
    this.notifyUpdate.alertNotify.next({
      msg: 'Lab data not found for printing.',
      type: 'error'
    });
    return;
  }

  // Format date properly
  const formattedDate = new Date(lab.dateTime).toLocaleString();

  // Generate printable HTML
const slipHtml = `
<html>
  <head>
    <title>Lab Patient Slip</title>
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f8fb; margin: 0; padding: 0; }
      .slip-container { background: #fff; border-radius: 12px; box-shadow: 0 4px 24px #1976d233; max-width: 650px; margin: 40px auto; padding: 36px 40px; }
      .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; }
      .logo { font-size: 32px; font-weight: bold; color: #1976d2; letter-spacing: 2px; }
      .lab-info { text-align: right; font-size: 14px; color: #555; }
      h2 { text-align: center; margin-bottom: 28px; color: #1976d2; font-size: 28px; font-weight: 600; }
      table { width: 100%; border-collapse: separate; border-spacing: 0 8px; margin-bottom: 24px; }
      th, td { padding: 12px 16px; font-size: 17px; border-radius: 6px; }
      th { background: #e3f2fd; color: #1976d2; text-align: left; width: 38%; font-weight: 500; }
      td { background: #f9f9f9; color: #222; }
      .section-title { font-weight: bold; color: #1976d2; margin-top: 24px; margin-bottom: 8px; font-size: 18px; }
      .footer { text-align: center; margin-top: 40px; color: #888; font-size: 15px; }
      @media print {
        body { background: #fff; }
        .slip-container { box-shadow: none; margin: 0; }
      }
    </style>
  </head>
  <body>
    <div class="slip-container">
      <div class="header">
        <div class="logo">Haq Medical Center Lab</div>
        <div class="lab-info">
          <div>Haq Medical Center</div>
          <div>${new Date().toLocaleDateString()}</div>
        </div>
      </div>
      <h2>Patient Test Slip</h2>
      <table>
        <tr><th>MR No.</th><td>${lab.patientId}</td></tr>
        <tr><th>Date</th><td>${new Date(lab.dateTime).toLocaleDateString()}</td></tr>
        <tr><th>Time</th><td>${new Date(lab.dateTime).toLocaleTimeString()}</td></tr>
        <tr><th>Patient Name</th><td>${lab.name}</td></tr>
        <tr><th>Phone</th><td>${lab.phone || '-'}</td></tr>
        <tr><th>Test Name</th><td>${lab.testName}</td></tr>
        <tr><th>Price</th><td>Rs. ${lab.price}</td></tr>
        <tr><th>Doctor Name</th><td>${lab.suggestedDr}</td></tr>
      </table>
      <div class="footer">
        Printed by  HMC Software &mdash; ${new Date().toLocaleString()}
      </div>
    </div>
    <script>
      window.onload = function() {
        window.print();
        setTimeout(() => window.close(), 1000);
      };
    </script>
  </body>
</html>
`;

  // Open a print window
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(slipHtml);
    printWindow.document.close();
  } else {
    this.notifyUpdate.alertNotify.next({
      msg: 'Popup blocked. Please allow popups to print.',
      type: 'error'
    });
  }
}
}
