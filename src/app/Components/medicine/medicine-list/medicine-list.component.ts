import { AfterViewInit, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import * as XLSX from 'xlsx';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';
import { Medicine } from 'src/app/Models/medicine.model';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { MedicineDataService } from '../../../Services/medicine-data.service';
import { MedicineService } from '../../../Services/medicine.service';
import { ShowalertService } from 'src/app/Services/showalert.service';
import { IndexedDbService } from 'src/app/Services/indexed-db.service';
import { MedicineEditComponent } from '../medicine-edit/medicine-edit.component';
import { MedicineSlipComponent } from '../medicine-slip/medicine-slip.component';

@Component({
  selector: 'app-medicine-list',
  templateUrl: './medicine-list.component.html',
  styleUrls: ['./medicine-list.component.css']
})
export class MedicineListComponent implements OnInit, AfterViewInit {

  medicine: Medicine[] = [];
  filteredMedicines: Medicine[] = [];
  dataSource: MedicineDataService = new MedicineDataService(this.medicineService);
  displayedColumns: string[] = [ 'createdAt','medicineId', 'patientName', 'roomNo', 'doctorName',];

  // Search fields
  searchMedicineId: string = '';
  searchRoomNo: string = '';
  searchPatientName: string = '';
  searchMedicineName: string = '';
  searchDoctorName: string = '';
  dateFilter: string = 'all';

@ViewChild(MatPaginator) paginator!: MatPaginator;

  total: number = 0;
  isSuperAdmin: boolean = false;

  addNewMedicine() {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.data = { medicines: [] };

    const dialogRef = this.dialog.open(MedicineEditComponent, dialogConfig);

    dialogRef.afterClosed().subscribe((resultData: Medicine[] | null) => {
      if (resultData) {
        this.notifyUpdate.notify.next(true);
      }
    });
  }

  constructor(
    private medicineService: MedicineService,
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
    this.dataSource.loadMedicine(a, b, c, d);

    if (this.paginator) {
      this.paginator.pageIndex = c;
      this.paginator.pageSize = d;
    }

    this.total = this.medicineService.total;

    this.medicineService.getAllMedicine().subscribe((medicines) => {
      this.medicine = medicines;
      this.filteredMedicines = medicines;
      this.dataSource.updateMedicines(this.filteredMedicines);
      this.changeDetectorRef.detectChanges();
    });
  }

  // Search
  onSearch() {
    this.filteredMedicines = this.medicine.filter(m => {
      const matchesId = this.searchMedicineId ? m.medicineId.toString().includes(this.searchMedicineId) : true;
      const matchesRoom = this.searchRoomNo ? m.roomNo.toLowerCase().includes(this.searchRoomNo.toLowerCase()) : true;
      const matchesPatient = this.searchPatientName ? m.patientName.toLowerCase().includes(this.searchPatientName.toLowerCase()) : true;
      const matchesMedicine = this.searchMedicineName ? m.medicines.some(med => med.medicineName.toLowerCase().includes(this.searchMedicineName.toLowerCase())) : true;
      const matchesDoctor = this.searchDoctorName ? m.doctorName.toLowerCase().includes(this.searchDoctorName.toLowerCase()) : true;
      return matchesId && matchesRoom && matchesPatient && matchesMedicine && matchesDoctor;
    });
    this.dataSource.updateMedicines(this.filteredMedicines);
  }

  onClearSearch() {
    this.searchMedicineId = '';
    this.searchRoomNo = '';
    this.searchPatientName = '';
    this.searchMedicineName = '';
    this.searchDoctorName = '';
    this.dateFilter = 'all';
    this.filteredMedicines = this.medicine;
    this.dataSource.updateMedicines(this.filteredMedicines);
  }

  onDateFilter() {
    let tempList = [...this.medicine];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    switch (this.dateFilter) {
      case 'today':
        const today = new Date(now);
        tempList = tempList.filter(m => {
          const createdDate = new Date(now);
          createdDate.setHours(0,0,0,0);
          return createdDate >= today;
        });
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const tomorrow = new Date(now);
        tempList = tempList.filter(m => {
          const createdDate = new Date(now);
          createdDate.setHours(0,0,0,0);
          return createdDate >= yesterday && createdDate < tomorrow;
        });
        break;
    }
    this.filteredMedicines = tempList;
    this.dataSource.updateMedicines(this.filteredMedicines);
  }

  // Export
  exportToExcel() {
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(
      this.filteredMedicines.length ? this.filteredMedicines : this.medicine
    );
    const workbook: XLSX.WorkBook = { Sheets: { 'Medicines': worksheet }, SheetNames: ['Medicines'] };
    XLSX.writeFile(workbook, 'medicines.xlsx');
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

      const storedMedicines = await this.indexedDbService.getItem<Medicine[]>('medicineDetails') || [];
      let added = 0;

      for (const record of data) {
        const rec: any = record;
        const medicine: Medicine = {
          medicineId: rec.medicineId || 0,
          roomNo: rec.roomNo || '',
          patientName: rec.patientName || '',
          medicines: rec.medicines || [{ medicineName: rec.medicineName || '', quantity: rec.quantity || 0 }],
          doctorName: rec.doctorName || '',
          createdAt: rec.createdAt || new Date().toISOString()
        };

        if (!storedMedicines.some(p => p.medicineId === medicine.medicineId)) {
          storedMedicines.push(medicine);
          added++;
        }
      }

      if (added > 0) {
        await this.indexedDbService.setItem('medicineDetails', storedMedicines);
        this.notifyUpdate.notify.next(true);
      }

      storedMedicines.forEach((item: Medicine) => {
        this.medicine.push(item);
      });
      this.filteredMedicines = [...this.medicine];
      this.dataSource.updateMedicines(this.filteredMedicines);
    };
    reader.readAsBinaryString(target.files[0]);
  }

  // Edit
  editMedicine(id: number) {
    this.medicineService.getMedicineDetails(id).subscribe(data => {
      if (data) {
        const dialogConfig = new MatDialogConfig();
        dialogConfig.disableClose = true;
        dialogConfig.autoFocus = true;
        dialogConfig.data = { medicines: [data] };

        const dialogRef = this.dialog.open(MedicineEditComponent, dialogConfig);

        dialogRef.afterClosed().subscribe((resultData: Medicine[] | null) => {
          if (resultData) {
            const msg = "Medicine Data Updated Successfully";
            const type = "success";

            this.notifyUpdate.notify.next(true);
            this.notifyUpdate.alertNotify.next({ msg, type });
          }
        });
      } else {
        this.notifyUpdate.alertNotify.next({ msg: "Medicine not found", type: "error" });
      }
    });
  }

  // Delete
  async deleteMedicine(id: number) {
    const confirmed = confirm('Are you sure you want to delete this medicine record?');
    if (!confirmed) return;

    const result = await this.medicineService.deleteMedicine(id);
    let msg = 'Failed to delete medicine.';
    let type = 'error';

    if (result) {
      msg = 'Medicine deleted successfully.';
      type = 'success';
      this.notifyUpdate.notify.next(true);
    }

    this.notifyUpdate.alertNotify.next({ msg, type });
  }

  // Print
  printSlip(id: number) {
    this.medicineService.getMedicineDetails(id).subscribe(data => {
      if (data) {
        // Get all medicines for the same patient
        this.medicineService.getAllMedicine().subscribe(allMedicines => {
          const patientMedicines = allMedicines.filter(m => m.patientName === data.patientName);
          const flattened = patientMedicines.reduce((acc: any[], m: Medicine) => 
            acc.concat(m.medicines.map((med: any) => ({
              medicineId: m.medicineId,
              roomNo: m.roomNo,
              patientName: m.patientName,
              medicineName: med.medicineName,
              quantity: med.quantity,
              doctorName: m.doctorName,
              createdAt: m.createdAt
            }))), []);
          const dialogConfig = new MatDialogConfig();
          dialogConfig.disableClose = true;
          dialogConfig.autoFocus = true;
          dialogConfig.data = { medicines: flattened };

          const dialogRef = this.dialog.open(MedicineSlipComponent, dialogConfig);
        });
      }
    });
  }
}

