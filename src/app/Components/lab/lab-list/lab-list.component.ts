import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';
import { PatientDetail } from 'src/app/Models/patientDetail.model';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { LabEditComponent } from '../lab-edit/lab-edit.component';
import { LabPatientDataService } from 'src/app/Services/lab-data.service';
import { LabService } from 'src/app/Services/lab.service';
import { LabPatient } from 'src/app/Models/lab.model';
import { UserLoginService } from 'src/app/Services/user-login.service';
import { formatTime12 } from 'src/app/Pipes/time-format.pipe';

@Component({
  selector: 'app-lab-list',
  templateUrl: './lab-list.component.html',
  styleUrls: ['./lab-list.component.css']
})
export class LabListComponent implements OnInit, AfterViewInit {

  patient: LabPatient[] = [];
  displayedPatients: LabPatient[] = [];
  dataSource: LabPatientDataService = new LabPatientDataService(this.labService);
  displayedColumns: string[] = [];
  displayLimit: number = 20;
  readonly pageStep: number = 10;


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
    private userLogin: UserLoginService,
    private notifyUpdate: NotifyUpdateService) {

    this.paginator = new MatPaginator(this.intl, this.changeDetectorRef);

    this.notifyUpdate.notify.subscribe(() => {
      this.dataActions('', 'asc', 0, 5);
    });
  }

ngOnInit(): void {
  this.userLogin.getLoginUser().then((loginUser) => {
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

  onTableScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (!el) return;
    const threshold = 120;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
      if (this.displayLimit < this.patient.length) {
        this.displayLimit = Math.min(this.displayLimit + this.pageStep, this.patient.length);
        this.updateDisplayedPatients();
      }
    }
  }

  private updateDisplayedPatients(): void {
    this.displayedPatients = this.patient.slice(0, this.displayLimit);
    this.dataSource.updatePatients(this.displayedPatients);
  }

  dataActions(a: string, b: string, c: number, d: number): void {
    this.dataSource.loadLabPatient(a, b, c, d);
    if (this.paginator) {
      this.paginator.pageIndex = c;
      this.paginator.pageSize = d;
    }
    this.total = this.labService.total;

    this.labService.getAllLabPatient().subscribe(patients => {
      this.patient = patients;
      this.displayLimit = 20;
      this.updateDisplayedPatients();
    });
  }

 editLabPatient(id: number) {
  this.labService.getLabPatientDetails(id).subscribe(data => {
    this.tempLabPatient = data;

    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.data = {...data};

    const dialogRef = this.dialog.open(LabEditComponent, dialogConfig);

    dialogRef.afterClosed().subscribe(async (data: LabPatient) => {
      if (data) {
        console.log("data", data);
        const success = await this.labService.updateLabPatient(data);
        const msg = success ? "Lab Patient Data Updated Successfully" : "Something went wrong";
        const type = success ? "success" : "error";
        if (success) {
          this.notifyUpdate.notify.next(true);
        }
        this.notifyUpdate.alertNotify.next({ msg, type });
      }
    });
  });
}

  async deleteLabPatient(id: number): Promise<void> {
    if (confirm('Are you sure you want to delete this lab patient?')) {
      const success = await this.labService.deleteLabPatient(id);
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
    }
  }

printLabSlip(patientId: string): void {
  const labs = this.dataSource['labSubject']?.getValue?.() ?? [];
  const lab = labs.find(item => String(item.patientId) === String(patientId));

  if (!lab) {
    this.notifyUpdate.alertNotify.next({
      msg: 'Lab data not found for printing.',
      type: 'error'
    });
    return;
  }

  const printDate = new Date();
  const patientDate = new Date(lab.dateTime);

  const escapeHtml = (value: unknown): string =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const formatDisplayDate = (date: Date): string =>
    date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });

  const formatDisplayTime = (date: Date): string =>
    date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

  const formatPrintStamp = (date: Date): string =>
    `${date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;

  const slipHtml = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Patient Test Slip</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }

          html, body {
            margin: 0;
            padding: 0;
            width: 80mm;
            background: #fff;
            color: #000;
            font-family: "Segoe UI", Arial, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            width: 80mm;
            max-width: 80mm;
            overflow: visible;
          }

          .receipt {
            width: 72mm;
            margin: 0;
            padding: 2mm 2mm 1.5mm;
            box-sizing: border-box;
            background: #fff;
            color: #000;
            page-break-inside: avoid;
            break-inside: avoid;
            overflow: visible;
          }

          .brand {
            font-size: 11pt;
            font-weight: 700;
            text-align: center;
            line-height: 1.2;
            margin-bottom: 1mm;
          }

          .title {
            font-size: 10.5pt;
            font-weight: 700;
            text-align: center;
            margin-bottom: 2mm;
          }

          .meta {
            font-size: 7.2pt;
            text-align: center;
            margin-bottom: 2mm;
          }

          .rule {
            border-top: 1px dashed #000;
            margin: 1.5mm 0;
          }

          .row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 3mm;
            width: 100%;
            margin: 1.2mm 0;
            font-size: 8.2pt;
            line-height: 1.25;
          }

          .label {
            font-weight: 700;
            min-width: 30%;
            flex: 0 0 30%;
          }

          .value {
            flex: 1;
            text-align: right;
            word-break: break-word;
            overflow-wrap: anywhere;
            font-weight: 600;
          }

          .footer-note {
            font-size: 7.2pt;
            text-align: center;
            margin-top: 2mm;
          }

          .thanks {
            font-size: 12pt;
            font-weight: 700;
            text-align: center;
            margin-top: 2mm;
            letter-spacing: 0.4pt;
          }

          @media print {
            @page {
              size: 80mm auto;
              margin: 0;
            }

            html, body {
              width: 80mm;
              margin: 0 !important;
              padding: 0 !important;
              background: #fff;
            }

            body {
              display: block;
            }

            * {
              box-sizing: border-box;
            }

            .receipt {
              position: absolute;
              left: 0;
              top: 0;
              width: 72mm;
              margin: 0;
              padding: 2mm 2mm 1.5mm;
              page-break-inside: avoid;
              break-inside: avoid;
            }

            body > *:not(.receipt) {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        <section class="receipt">
          <div class="brand">Haq Medical Center Lab</div>
          <div class="title">Patient Test Slip</div>
          <div class="meta">${escapeHtml(formatPrintStamp(printDate))}</div>

          <div class="rule"></div>

          <div class="row">
            <span class="label">MR No.</span>
            <span class="value">${escapeHtml(lab.patientId)}</span>
          </div>
          <div class="row">
            <span class="label">Date</span>
            <span class="value">${escapeHtml(formatDisplayDate(patientDate))}</span>
          </div>
          <div class="row">
            <span class="label">Time</span>
            <span class="value">${escapeHtml(formatDisplayTime(patientDate))}</span>
          </div>
          <div class="row">
            <span class="label">Patient Name</span>
            <span class="value">${escapeHtml(lab.name || '-')}</span>
          </div>
          <div class="row">
            <span class="label">Phone</span>
            <span class="value">${escapeHtml(lab.phone || '-')}</span>
          </div>
          <div class="row">
            <span class="label">Test Name</span>
            <span class="value">${escapeHtml(lab.testName || '-')}</span>
          </div>
          <div class="row">
            <span class="label">Price</span>
            <span class="value">Rs. ${escapeHtml(lab.price ?? 0)}</span>
          </div>
          <div class="row">
            <span class="label">Doctor Name</span>
            <span class="value">${escapeHtml(lab.suggestedDr || '-')}</span>
          </div>

          <div class="rule"></div>

          <div class="footer-note">Printed by HMC Software</div>
          <div class="footer-note">${escapeHtml(formatPrintStamp(printDate))}</div>
          <div class="thanks">Thank You!</div>
        </section>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=500,height=700,menubar=no,toolbar=no,location=no,status=no');

  if (!printWindow) {
    this.notifyUpdate.alertNotify.next({
      msg: 'Popup blocked. Please allow popups to print.',
      type: 'error'
    });
    return;
  }

  printWindow.document.open();
  printWindow.document.write(slipHtml);
  printWindow.document.close();

  printWindow.focus();
  printWindow.onload = () => {
    printWindow.setTimeout(() => {
      printWindow.print();
      printWindow.setTimeout(() => printWindow.close(), 500);
    }, 200);
  };
}
}
