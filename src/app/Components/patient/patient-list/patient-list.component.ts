import { AfterViewInit, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import * as XLSX from 'xlsx';
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
export class PatientListComponent implements OnInit, AfterViewInit {

  patient: Patient[] = [];
  filteredPatients: Patient[] = [];
  dataSource: PatientDataService = new PatientDataService(this.patientService);
  displayedColumns: string[] = [];

  // 🔍 Search fields
  searchPatientId: string = '';
  searchName: string = '';
  searchPhone: string = '';
  searchCity: string = '';

  tempPatient: PatientDetail = {
    patientId: 0,
    firstName: '',
    lastName: '',
    drName: '',
    gender: '',
    age: 0,
    maritalStatus: '',
    phone: '',
    city: '',
    address: ''
  };

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  total: number = 0;
  isSuperAdmin: boolean = false;

  constructor(
    private patientService: PatientService,
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
      this.displayedColumns = ['patientId', 'name', 'drName', 'gender', 'phone', 'city'];
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
    this.dataSource.loadPatient(a, b, c, d);

    if (this.paginator) {
      this.paginator.pageIndex = c;
      this.paginator.pageSize = d;
    }

    this.total = this.patientService.total;

    this.patientService.getAllPatient().subscribe((patients) => {
      this.patient = patients;
      this.filteredPatients = patients;
      this.dataSource.updatePatients(this.filteredPatients);
    });
  }

  // 🔍 Search
  onSearch() {
    this.filteredPatients = this.patient.filter(p => {
      const matchesId = this.searchPatientId ? p.patientId.toString().includes(this.searchPatientId) : true;
      const matchesName = this.searchName ? p.name.toLowerCase().includes(this.searchName.toLowerCase()) : true;
      const matchesPhone = this.searchPhone ? (p.contact || '').toString().includes(this.searchPhone) : true;
      const matchesCity = this.searchCity ? (p.city || '').toLowerCase().includes(this.searchCity.toLowerCase()) : true;
      return matchesId && matchesName && matchesPhone && matchesCity;
    });

    this.dataSource.updatePatients(this.filteredPatients);
  }

  onClearSearch() {
    this.searchPatientId = '';
    this.searchName = '';
    this.searchPhone = '';
    this.searchCity = '';
    this.filteredPatients = this.patient;
    this.dataSource.updatePatients(this.filteredPatients);
  }

  // 📤 Export
  exportToExcel() {
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(
      this.filteredPatients.length ? this.filteredPatients : this.patient
    );
    const workbook: XLSX.WorkBook = { Sheets: { 'Patients': worksheet }, SheetNames: ['Patients'] };
    XLSX.writeFile(workbook, 'patients.xlsx');
  }

  // 📥 Import
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

      const storedPatients = await this.indexedDbService.getItem<any[]>('patientDetails') || [];
      let added = 0;

      for (const record of data) {
        const rec: any = record;
        const patientDetail: any = {
          patientId: rec.patientId,
          firstName: rec.firstName || rec.name?.split(' ')[0] || '',
          lastName: rec.lastName || rec['Father Name'] || rec.name?.split(' ')[1] || '',
          drName: rec.drName || rec['Dr Name'] || '',
          gender: rec.gender || '',
          age: rec.age || '',
          maritalStatus: rec.maritalStatus || '',
          phone: rec.phone || rec.contact || '',
          city: rec.city || '',
          address: rec.address || ''
        };

        if (!storedPatients.some(p => p.patientId == patientDetail.patientId)) {
          storedPatients.push(patientDetail);
          added++;
        }
      }

      if (added > 0) {
        await this.indexedDbService.setItem('patientDetails', storedPatients);
        this.notifyUpdate.notify.next(true);
      }

      this.patient = storedPatients;
      this.filteredPatients = this.patient;
      this.dataSource.updatePatients(this.filteredPatients);
    };
    reader.readAsBinaryString(target.files[0]);
  }

  // ✏️ Edit
  editPatient(id: number) {
    this.patientService.getPatientDetails(id).subscribe(data => {
      if (data) {
        this.tempPatient = data;
        (this.tempPatient as any).oldId = id;

        const dialogConfig = new MatDialogConfig();
        dialogConfig.disableClose = true;
        dialogConfig.autoFocus = true;
        dialogConfig.data = this.tempPatient;

        const dialogRef = this.dialog.open(PatientEditComponent, dialogConfig);

        dialogRef.afterClosed().subscribe((data: PatientDetail) => {
          if (data) {
            const res: any = this.patientService.updatePatient(data);
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

  // 🗑️ Delete
  async deletePatient(id: number) {
    const confirmed = confirm('Are you sure you want to delete this patient?');
    if (!confirmed) return;

    const result = await this.patientService.deletePatient(id);
    let msg = 'Failed to delete patient.';
    let type = 'error';

    if (result) {
      msg = 'Patient deleted successfully.';
      type = 'success';
      this.notifyUpdate.notify.next(true);
    }

    this.notifyUpdate.alertNotify.next({ msg, type });
  }
}
