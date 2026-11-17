import { ScrollPagination, trackRecord } from 'src/app/Shared/scroll-pagination';
import { includesText, matchesDateFilter } from 'src/app/Shared/list-filters';
import { firstValueFrom, Subscription } from 'rxjs';
import { RecordDetailsComponent } from 'src/app/Components/record-details/record-details.component';
import { exportRecords } from 'src/app/Shared/export-records';
import { ChangeDetectorRef, Component, OnInit , OnDestroy } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { Medicine } from 'src/app/Models/medicine.model';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { MedicineDataService } from '../../../Services/medicine-data.service';
import { MedicineService } from '../../../Services/medicine.service';
import { ShowalertService } from 'src/app/Services/showalert.service';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';
import { UserLoginService } from 'src/app/Services/user-login.service';
import { MedicineEditComponent } from '../medicine-edit/medicine-edit.component';
import { MedicineSlipComponent } from '../medicine-slip/medicine-slip.component';

@Component({
  selector: 'app-medicine-list',
  templateUrl: './medicine-list.component.html',
  styleUrls: ['./medicine-list.component.css']
})
export class MedicineListComponent implements OnInit, OnDestroy {
  readonly pagination = new ScrollPagination();
  readonly trackRecord = trackRecord;
  private loadVersion = 0;
  loading = false;
  loadFailed = false;
  deletingId: number | null = null;
  loadMore(): void { this.pagination.loadMore(this.total); this.updateDisplayedMedicines(); }

  private refreshSubscription?: Subscription;
  ngOnDestroy(): void { this.refreshSubscription?.unsubscribe(); this.loadVersion++; }
  async viewMedicine(id: number): Promise<void> {
    try {
      const record = await firstValueFrom(this.medicineService.getMedicineDetails(id));
      if (!record) throw new Error('Record not found.');
      this.dialog.open(RecordDetailsComponent, { data: { title: 'Medicine record', record } });
    } catch (error) { this.notifyUpdate.alertNotify.next({ type: 'error', msg: error instanceof Error ? error.message : 'Unable to load record.' }); }
  }


  medicine: Medicine[] = [];
  filteredMedicines: Medicine[] = [];
  displayedMedicines: Medicine[] = [];
  dataSource: MedicineDataService = new MedicineDataService(this.medicineService);
  displayedColumns: string[] = [ 'createdAt','medicineId', 'patientName', 'roomNo', 'doctorName',];

  // Search fields
  searchMedicineId: string = '';
  searchRoomNo: string = '';
  searchPatientName: string = '';
  searchMedicineName: string = '';
  searchDoctorName: string = '';
  dateFilter: string = 'all';
  get savedRoomValues(): string[] { return [...new Set(this.medicine.map(record => record.roomNo).filter(Boolean))]; }

  total: number = 0;
  isSuperAdmin: boolean = false;

  addNewMedicine() {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.data = { medicines: [] };
    dialogConfig.panelClass = 'hmc-dialog-panel';
    dialogConfig.width = 'min(820px, calc(100vw - 32px))';
    dialogConfig.maxWidth = '94vw';
    dialogConfig.maxHeight = '92vh';

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
    private indexedDbService: SupabaseDataService,
    private userLogin: UserLoginService
  ) {
    this.refreshSubscription = this.notifyUpdate.notify.subscribe(() => {
      this.dataActions('', 'asc', 0, 5);
    });
  }

  ngOnInit(): void {
    this.loading = true;
    this.userLogin.getLoginUser().then((loginUser) => {
      this.isSuperAdmin = loginUser === 'admin';
      this.displayedColumns.push('action');
      this.dataActions('', 'asc', 0, 5);
    }).catch(() => { this.loading = false; this.loadFailed = true; this.notifyUpdate.alertNotify.next({ type: 'error', msg: 'Account permissions could not be loaded. Please refresh the page.' }); });
  }
  private updateDisplayedMedicines(): void {
    this.total = this.filteredMedicines.length;
    this.displayedMedicines = this.pagination.slice(this.filteredMedicines);
    this.dataSource.updateMedicines(this.displayedMedicines);
  }

  dataActions(_filter: string, _sort: string, _page: number, _size: number): void {
    const version = ++this.loadVersion;
    this.loading = true; this.loadFailed = false;
    this.medicineService.getAllMedicine().subscribe({
      next: records => { if (version !== this.loadVersion) return; this.medicine = records; this.onDateFilter(false); this.loading = false; },
      error: error => { if (version === this.loadVersion) { this.loading = false; this.loadFailed = true; this.notifyUpdate.alertNotify.next({ type: 'error', msg: error instanceof Error ? error.message : 'Unable to load records.' }); } }
    });
  }

  onSearch(): void { this.onDateFilter(); }

  onClearSearch(): void { this.searchMedicineId = ''; this.searchRoomNo = ''; this.searchPatientName = ''; this.searchDoctorName = ''; this.searchMedicineName = ''; this.dateFilter = 'all'; this.onDateFilter(); }

  onDateFilter(reset = true): void {
    this.filteredMedicines = this.medicine.filter(record => matchesDateFilter(record.createdAt, this.dateFilter) && includesText(record.medicineId, this.searchMedicineId) && (!this.searchRoomNo || record.roomNo === this.searchRoomNo) && includesText(record.patientName, this.searchPatientName) && includesText(record.doctorName, this.searchDoctorName) && includesText(record.medicines.map(medicine => medicine.medicineName).join(' '), this.searchMedicineName));
    if (reset) this.pagination.reset();
    this.updateDisplayedMedicines();
  }

  exportToExcel(): void { exportRecords(this.filteredMedicines, 'daily-medicines.xlsx'); }


  // Edit
  editMedicine(id: number) {
    this.medicineService.getMedicineDetails(id).subscribe({ next: data => {
      if (data) {
        const dialogConfig = new MatDialogConfig();
        dialogConfig.disableClose = true;
        dialogConfig.autoFocus = true;
        dialogConfig.data = { medicines: [data] };
        dialogConfig.panelClass = 'hmc-dialog-panel';
        dialogConfig.width = 'min(820px, calc(100vw - 32px))';
        dialogConfig.maxWidth = '94vw';
        dialogConfig.maxHeight = '92vh';

        const dialogRef = this.dialog.open(MedicineEditComponent, dialogConfig);

        dialogRef.afterClosed().subscribe((resultData: Medicine[] | null) => {
          if (resultData) {
            const msg = "Daily medicine record updated successfully.";
            const type = "success";

            this.notifyUpdate.notify.next(true);
            this.notifyUpdate.alertNotify.next({ msg, type });
          }
        });
      } else {
        this.notifyUpdate.alertNotify.next({ msg: "Medicine not found", type: "error" });
      }
    }, error: () => this.notifyUpdate.alertNotify.next({ type: 'error', msg: 'Daily medicine record details could not be loaded. Refresh the list and try again.' }) });
  }

  // Delete
  async deleteMedicine(id: number): Promise<void> {
    if (this.deletingId !== null || !window.confirm('Delete this daily medicine record? This action cannot be undone.')) return;
    this.deletingId = id;
    try {
      const saved = await this.medicineService.deleteMedicine(id);
      if (!saved) throw new Error('Daily medicine record could not be deleted. Refresh the list and try again.');
      this.notifyUpdate.notify.next(true);
      this.notifyUpdate.alertNotify.next({ type: 'success', msg: 'Daily medicine record deleted successfully.' });
    } catch (error) { this.notifyUpdate.alertNotify.next({ type: 'error', msg: error instanceof Error ? error.message : 'Daily medicine record could not be deleted. Please try again.' }); }
    finally { this.deletingId = null; }
  }

  async printSlip(id: number): Promise<void> {
    try {
      const record = await firstValueFrom(this.medicineService.getMedicineDetails(id));
      if (!record) throw new Error('Medicine record not found.');
      this.dialog.open(MedicineSlipComponent, { data: { record }, width: '480px', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' });
    } catch (error) {
      this.notifyUpdate.alertNotify.next({ type: 'error', msg: error instanceof Error ? error.message : 'Unable to load the medicine receipt.' });
    }
  }
}
