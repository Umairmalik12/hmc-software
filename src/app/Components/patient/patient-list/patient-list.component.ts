import { EventEmitter, Output } from '@angular/core';
import { ScrollPagination, trackRecord } from 'src/app/Shared/scroll-pagination';
import { includesText, matchesDateFilter } from 'src/app/Shared/list-filters';
import { firstValueFrom, Subscription } from 'rxjs';
import { RecordDetailsComponent } from 'src/app/Components/record-details/record-details.component';
import { exportRecords } from 'src/app/Shared/export-records';
import { ChangeDetectorRef, Component, OnInit , OnDestroy } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { Patient } from 'src/app/Models/patient.model';
import { PatientDetail } from 'src/app/Models/patientDetail.model';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { PatientDataService } from 'src/app/Services/patient-data.service';
import { PatientService } from 'src/app/Services/patient.service';
import { ShowalertService } from 'src/app/Services/showalert.service';
import { PatientEditComponent } from '../patient-edit/patient-edit.component';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';
import { UserLoginService } from 'src/app/Services/user-login.service';

@Component({
  selector: 'app-patient-list',
  templateUrl: './patient-list.component.html',
  styleUrls: ['./patient-list.component.css']
})
export class PatientListComponent implements OnInit, OnDestroy {
  @Output() create = new EventEmitter<void>();

  readonly pagination = new ScrollPagination();
  readonly trackRecord = trackRecord;
  private loadVersion = 0;
  loading = false;
  loadFailed = false;
  deletingId: number | null = null;
  loadMore(): void { this.pagination.loadMore(this.total); this.updateDisplayedPatients(); }

  private refreshSubscription?: Subscription;
  ngOnDestroy(): void { this.refreshSubscription?.unsubscribe(); this.loadVersion++; }
  async viewPatient(id: number): Promise<void> {
    try {
      const record = await firstValueFrom(this.patientService.getPatientDetails(id));
      if (!record) throw new Error('Record not found.');
      this.dialog.open(RecordDetailsComponent, { data: { title: 'Operation patient', record } });
    } catch (error) { this.notifyUpdate.alertNotify.next({ type: 'error', msg: error instanceof Error ? error.message : 'Unable to load record.' }); }
  }


  patient: Patient[] = [];
  filteredPatients: Patient[] = [];
  displayedPatients: Patient[] = [];
  dataSource: PatientDataService = new PatientDataService(this.patientService);
  displayedColumns: string[] = [];

  // 🔍 Search fields
  searchPatientId: string = '';
  searchName: string = '';
  searchPhone: string = '';
  searchProcedure: string = '';
  searchCity: string = '';
  dateFilter: string = 'all';

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
    address: '',
    procedure: '',
    createdAt: ''
  };

  total: number = 0;
  isSuperAdmin: boolean = false;

  constructor(
    private patientService: PatientService,
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
      this.displayedColumns = ['patientId', 'name', 'drName', 'gender', 'phone', 'procedure', 'city' , 'createdAt'];
      this.displayedColumns.push('action');
      this.dataActions('', 'asc', 0, 5);
    }).catch(() => { this.loading = false; this.loadFailed = true; this.notifyUpdate.alertNotify.next({ type: 'error', msg: 'Account permissions could not be loaded. Please refresh the page.' }); });
  }
  private updateDisplayedPatients(): void {
    this.total = this.filteredPatients.length;
    this.displayedPatients = this.pagination.slice(this.filteredPatients);
    this.dataSource.updatePatients(this.displayedPatients);
  }

  dataActions(_filter: string, _sort: string, _page: number, _size: number): void {
    const version = ++this.loadVersion;
    this.loading = true; this.loadFailed = false;
    this.patientService.getAllPatient().subscribe({
      next: records => { if (version !== this.loadVersion) return; this.patient = records; this.onDateFilter(false); this.loading = false; },
      error: error => { if (version === this.loadVersion) { this.loading = false; this.loadFailed = true; this.notifyUpdate.alertNotify.next({ type: 'error', msg: error instanceof Error ? error.message : 'Unable to load records.' }); } }
    });
  }

  onDateFilter(reset = true): void {
    this.filteredPatients = this.patient.filter(record => matchesDateFilter(record.createdAt, this.dateFilter) && includesText(record.patientId, this.searchPatientId) && includesText(record.name, this.searchName) && includesText(record.contact, this.searchPhone) && includesText(record.procedure, this.searchProcedure) && includesText(record.city, this.searchCity));
    if (reset) this.pagination.reset();
    this.updateDisplayedPatients();
  }

  onSearch(): void { this.onDateFilter(); }

  onClearSearch(): void { this.searchPatientId = ''; this.searchName = ''; this.searchPhone = ''; this.searchProcedure = ''; this.searchCity = ''; this.dateFilter = 'all'; this.onDateFilter(); }

  exportToExcel(): void { exportRecords(this.filteredPatients, 'operation-patients.xlsx', 'Records', this.notifyUpdate); }


  // ✏️ Edit
  editPatient(id: number) {
    this.patientService.getPatientDetails(id).subscribe({ next: data => {
      if (data) {
        this.tempPatient = data;
        this.tempPatient.oldId = id;

        const dialogConfig = new MatDialogConfig();
        dialogConfig.disableClose = true;
        dialogConfig.autoFocus = true;
        dialogConfig.data = this.tempPatient;
        dialogConfig.panelClass = 'hmc-dialog-panel';

        const dialogRef = this.dialog.open(PatientEditComponent, dialogConfig);

        dialogRef.afterClosed().subscribe(async (data: PatientDetail) => {
          if (data) {
            let saved = false;
            try {
              saved = await this.patientService.updatePatient(data);
            } catch (error) {
              console.error('Unable to update operation patient:', error);
            }
            const msg = saved ? 'Operation patient updated successfully.' : 'Operation patient could not be updated. Please try again.';
            const type = saved ? 'success' : 'error';
            if (saved) {
              this.notifyUpdate.notify.next(true);
            }
            this.notifyUpdate.alertNotify.next({ msg, type });
          }
        });
      } else {
        this.notifyUpdate.alertNotify.next({ msg: "Patient not found", type: "error" });
      }
    }, error: () => this.notifyUpdate.alertNotify.next({ type: 'error', msg: 'Operation patient details could not be loaded. Refresh the list and try again.' }) });
  }

  // 🗑️ Delete
  async deletePatient(id: number): Promise<void> {
    if (this.deletingId !== null || !window.confirm('Delete this operation patient? This action cannot be undone.')) return;
    this.deletingId = id;
    try {
      const saved = await this.patientService.deletePatient(id);
      if (!saved) throw new Error('Operation patient could not be deleted. Refresh the list and try again.');
      this.notifyUpdate.notify.next(true);
      this.notifyUpdate.alertNotify.next({ type: 'success', msg: 'Operation patient deleted successfully.' });
    } catch (error) { this.notifyUpdate.alertNotify.next({ type: 'error', msg: error instanceof Error ? error.message : 'Operation patient could not be deleted. Please try again.' }); }
    finally { this.deletingId = null; }
  }
}
