import { AfterViewInit, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import * as XLSX from 'xlsx';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';
import { InPatient } from 'src/app/Models/inpatient.model';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { InpatientDataService } from '../../../Services/inpatient-data.service';
import { InpatientService } from '../../../Services/inpatient.service';
import { ShowalertService } from 'src/app/Services/showalert.service';
import { InpatientEditComponent } from '../inpatient-edit/inpatient-edit.component';
import { IndexedDbService } from 'src/app/Services/indexed-db.service';

@Component({
  selector: 'app-inpatient-list',
  templateUrl: './inpatient-list.component.html',
  styleUrls: ['./inpatient-list.component.css']
})
export class InpatientListComponent implements OnInit, AfterViewInit {

  inpatient: InPatient[] = [];
  filteredInpatients: InPatient[] = [];
  dataSource: InpatientDataService = new InpatientDataService(this.inpatientService);
  displayedColumns: string[] = ['inpatientId', 'patientName', 'procedure', 'admissionDate', 'dischargeDate', 'surgeonName'];

  // Search fields
  searchInpatientId: string = '';
  searchPatientName: string = '';
  searchProcedure: string = '';
  searchSurgeonName: string = '';

  tempInpatient: any = {
    inpatientId: 0,
    patientName: '',
    procedure: '',
    admissionDate: '',
    dischargeDate: '',
    surgeonName: ''
  };

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  total: number = 0;
  isSuperAdmin: boolean = false;

  constructor(
    private inpatientService: InpatientService,
    private dialog: MatDialog,
    private intl: MatPaginatorIntl,
    private changeDetectorRef: ChangeDetectorRef,
    private notifyUpdate: NotifyUpdateService,
    private indexedDbService: IndexedDbService
  ) {
    this.notifyUpdate.notify.subscribe(() => {
      this.dataActions('', 'asc', 0, 5);
    });
  }

  ngOnInit(): void {
    this.indexedDbService.getItem<string>('loginUser').then((loginUser) => {
      this.isSuperAdmin = loginUser === 'admin';
      if (this.isSuperAdmin) {
        this.displayedColumns.push('action');
      }
      this.dataActions('', 'asc', 0, 5);
    });
  }

  ngAfterViewInit(): void {
    this.paginator?.page.subscribe(() => {
      this.dataActions('', 'asc', this.paginator.pageIndex, this.paginator.pageSize);
    });
  }

  dataActions(a: string, b: string, c: number, d: number): void {
    this.dataSource.loadInpatient(a, b, c, d);

    if (this.paginator) {
      this.paginator.pageIndex = c;
      this.paginator.pageSize = d;
    }

    this.total = this.inpatientService.total;

    this.inpatientService.getAllInpatient().subscribe((inpatients) => {
      this.inpatient = inpatients;
      this.filteredInpatients = inpatients;
      this.dataSource.updateInpatients(this.filteredInpatients);
    });
  }

  // Search
  onSearch() {
    this.filteredInpatients = this.inpatient.filter(i => {
      const matchesId = this.searchInpatientId ? i.inpatientId.toString().includes(this.searchInpatientId) : true;
      const matchesName = this.searchPatientName ? i.patientName.toLowerCase().includes(this.searchPatientName.toLowerCase()) : true;
      const matchesProcedure = this.searchProcedure ? i.procedure.toLowerCase().includes(this.searchProcedure.toLowerCase()) : true;
      const matchesSurgeon = this.searchSurgeonName ? i.surgeonName.toLowerCase().includes(this.searchSurgeonName.toLowerCase()) : true;
      return matchesId && matchesName && matchesProcedure && matchesSurgeon;
    });
    this.dataSource.updateInpatients(this.filteredInpatients);
  }

  onClearSearch() {
    this.searchInpatientId = '';
    this.searchPatientName = '';
    this.searchProcedure = '';
    this.searchSurgeonName = '';
    this.filteredInpatients = this.inpatient;
    this.dataSource.updateInpatients(this.filteredInpatients);
  }

  // Export
  exportToExcel() {
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(
      this.filteredInpatients.length ? this.filteredInpatients : this.inpatient
    );
    const workbook: XLSX.WorkBook = { Sheets: { 'InnPatients': worksheet }, SheetNames: ['InnPatients'] };
    XLSX.writeFile(workbook, 'innpatients.xlsx');
  }

  // Import
  async importFromExcel(event: any) {
    const target: DataTransfer = <DataTransfer>(event.target);
    if (target.files.length !== 1) return;

    const reader: FileReader = new FileReader();
    reader.onload = async (e: any) => {
      const bstr: string = e.target.result;
      const wb: XLSX.WorkBook = XLSX.read(bstr, { type: 'binary' });
      const wsname: string = wb.SheetNames[0];
      const ws: XLSX.WorkSheet = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const storedInpatients = await this.indexedDbService.getItem<any[]>('inpatientDetails') || [];
      let added = 0;

      for (const record of data) {
        const rec: any = record;
        const inpatientDetail: any = {
          inpatientId: rec.inpatientId,
          patientName: rec.patientName || '',
          procedure: rec.procedure || '',
          admissionDate: rec.admissionDate || '',
          dischargeDate: rec.dischargeDate || '',
          surgeonName: rec.surgeonName || ''
        };

        if (!storedInpatients.some(p => p.inpatientId == inpatientDetail.inpatientId)) {
          storedInpatients.push(inpatientDetail);
          added++;
        }
      }

      if (added > 0) {
        await this.indexedDbService.setItem('inpatientDetails', storedInpatients);
        this.notifyUpdate.notify.next(true);
      }

      storedInpatients.forEach((item: any) => {
        const briefItem: InPatient = {
          inpatientId: item.inpatientId,
          patientName: item.patientName,
          procedure: item.procedure,
          admissionDate: item.admissionDate,
          dischargeDate: item.dischargeDate,
          surgeonName: item.surgeonName
        };
        this.inpatient.push(briefItem);
      });
      this.filteredInpatients = [...this.inpatient];
      this.dataSource.updateInpatients(this.filteredInpatients);
    };
    reader.readAsBinaryString(target.files[0]);
  }

  // Edit
  editInpatient(id: number) {
    this.inpatientService.getInpatientDetails(id).subscribe(data => {
      if (data) {
        const dialogConfig = new MatDialogConfig();
        dialogConfig.disableClose = true;
        dialogConfig.autoFocus = true;
        dialogConfig.data = data;

        const dialogRef = this.dialog.open(InpatientEditComponent, dialogConfig);

        dialogRef.afterClosed().subscribe((resultData: any) => {
          if (resultData) {
            this.inpatientService.updateInpatient(resultData);
            const msg = "InnPatient Data Updated Successfully";
            const type = "success";

            this.notifyUpdate.notify.next(true);
            this.notifyUpdate.alertNotify.next({ msg, type });
          }
        });
      } else {
        this.notifyUpdate.alertNotify.next({ msg: "InnPatient not found", type: "error" });
      }
    });
  }

  // Delete
  async deleteInpatient(id: number) {
    const confirmed = confirm('Are you sure you want to delete this inpatient?');
    if (!confirmed) return;

    const result = await this.inpatientService.deleteInpatient(id);
    let msg = 'Failed to delete inpatient.';
    let type = 'error';

    if (result) {
      msg = 'InnPatient deleted successfully.';
      type = 'success';
      this.notifyUpdate.notify.next(true);
    }

    this.notifyUpdate.alertNotify.next({ msg, type });
  }
}
