import { EventEmitter, Output } from '@angular/core';
import { ScrollPagination, trackRecord } from 'src/app/Shared/scroll-pagination';
import { includesText, matchesDateFilter } from 'src/app/Shared/list-filters';
import { firstValueFrom, Subscription } from 'rxjs';
import { RecordDetailsComponent } from 'src/app/Components/record-details/record-details.component';
import { exportRecords } from 'src/app/Shared/export-records';
import { ChangeDetectorRef, Component, OnInit , OnDestroy } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { InPatient } from 'src/app/Models/inpatient.model';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { InpatientDataService } from '../../../Services/inpatient-data.service';
import { InpatientService } from '../../../Services/inpatient.service';
import { ShowalertService } from 'src/app/Services/showalert.service';
import { InpatientEditComponent } from '../inpatient-edit/inpatient-edit.component';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';
import { UserLoginService } from 'src/app/Services/user-login.service';

@Component({
  selector: 'app-inpatient-list',
  templateUrl: './inpatient-list.component.html',
  styleUrls: ['./inpatient-list.component.css']
})
export class InpatientListComponent implements OnInit, OnDestroy {
  @Output() create = new EventEmitter<void>();

  readonly pagination = new ScrollPagination();
  readonly trackRecord = trackRecord;
  private loadVersion = 0;
  loading = false;
  loadFailed = false;
  deletingId: number | null = null;
  loadMore(): void { this.pagination.loadMore(this.total); this.updateDisplayedInpatients(); }

  private refreshSubscription?: Subscription;
  ngOnDestroy(): void { this.refreshSubscription?.unsubscribe(); this.loadVersion++; }
  async viewInpatient(id: number): Promise<void> {
    try {
      const record = await firstValueFrom(this.inpatientService.getInpatientDetails(id));
      if (!record) throw new Error('Record not found.');
      this.dialog.open(RecordDetailsComponent, { data: { title: 'Inpatient', record } });
    } catch (error) { this.notifyUpdate.alertNotify.next({ type: 'error', msg: error instanceof Error ? error.message : 'Unable to load record.' }); }
  }


  inpatient: InPatient[] = [];
  filteredInpatients: InPatient[] = [];
  displayedInpatients: InPatient[] = [];
  dataSource: InpatientDataService = new InpatientDataService(this.inpatientService);
  displayedColumns: string[] = ['inpatientId', 'patientName', 'procedure', 'admissionDate', 'dischargeDate', 'surgeonName'];

  // Search fields
  searchInpatientId: string = '';
  searchPatientName: string = '';
  searchProcedure: string = '';
  searchSurgeonName: string = '';
  dateFilter: string = 'all';

  tempInpatient: any = {

    inpatientId: 0,
    patientName: '',
    procedure: '',
    admissionDate: '',
    dischargeDate: '',
    surgeonName: ''
  };

  total: number = 0;
  isSuperAdmin: boolean = false;

  constructor(
    private inpatientService: InpatientService,
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
      this.displayedColumns.push('createdAt');
      this.displayedColumns.push('action');
      this.dataActions('', 'asc', 0, 5);

    }).catch(() => { this.loading = false; this.loadFailed = true; this.notifyUpdate.alertNotify.next({ type: 'error', msg: 'Account permissions could not be loaded. Please refresh the page.' }); });
  }
  private updateDisplayedInpatients(): void {
    this.total = this.filteredInpatients.length;
    this.displayedInpatients = this.pagination.slice(this.filteredInpatients);
    this.dataSource.updateInpatients(this.displayedInpatients);
  }

  dataActions(_filter: string, _sort: string, _page: number, _size: number): void {
    const version = ++this.loadVersion;
    this.loading = true; this.loadFailed = false;
    this.inpatientService.getAllInpatient().subscribe({
      next: records => { if (version !== this.loadVersion) return; this.inpatient = records; this.onDateFilter(false); this.loading = false; },
      error: error => { if (version === this.loadVersion) { this.loading = false; this.loadFailed = true; this.notifyUpdate.alertNotify.next({ type: 'error', msg: error instanceof Error ? error.message : 'Unable to load records.' }); } }
    });
  }

  onSearch(): void { this.onDateFilter(); }

  onClearSearch(): void { this.searchInpatientId = ''; this.searchPatientName = ''; this.searchProcedure = ''; this.searchSurgeonName = ''; this.dateFilter = 'all'; this.onDateFilter(); }

  onDateFilter(reset = true): void {
    this.filteredInpatients = this.inpatient.filter(record => matchesDateFilter(record.createdAt, this.dateFilter) && includesText(record.inpatientId, this.searchInpatientId) && includesText(record.patientName, this.searchPatientName) && includesText(record.procedure, this.searchProcedure) && includesText(record.surgeonName, this.searchSurgeonName));
    if (reset) this.pagination.reset();
    this.updateDisplayedInpatients();
  }

  exportToExcel(): void { exportRecords(this.filteredInpatients, 'inpatients.xlsx'); }


  // Edit
  editInpatient(id: number) {
    this.inpatientService.getInpatientDetails(id).subscribe({ next: data => {
      if (data) {
        const dialogConfig = new MatDialogConfig();
        dialogConfig.disableClose = true;
        dialogConfig.autoFocus = true;
        dialogConfig.data = data;

        const dialogRef = this.dialog.open(InpatientEditComponent, dialogConfig);

        dialogRef.afterClosed().subscribe(async (resultData: any) => {
          if (resultData) {
            const success = await this.inpatientService.updateInpatient(resultData);
            const msg = success ? "Inpatient updated successfully." : "Inpatient could not be updated. Please try again.";
            const type = success ? "success" : "error";

            if (success) {
              this.notifyUpdate.notify.next(true);
            }
            this.notifyUpdate.alertNotify.next({ msg, type });
          }
        });
      } else {
        this.notifyUpdate.alertNotify.next({ msg: "This inpatient is no longer available. Refresh the list.", type: "error" });
      }
    }, error: () => this.notifyUpdate.alertNotify.next({ type: 'error', msg: 'Inpatient details could not be loaded. Refresh the list and try again.' }) });
  }

  // Delete
  async deleteInpatient(id: number): Promise<void> {
    if (this.deletingId !== null || !window.confirm('Delete this inpatient? This action cannot be undone.')) return;
    this.deletingId = id;
    try {
      const saved = await this.inpatientService.deleteInpatient(id);
      if (!saved) throw new Error('Inpatient could not be deleted. Refresh the list and try again.');
      this.notifyUpdate.notify.next(true);
      this.notifyUpdate.alertNotify.next({ type: 'success', msg: 'Inpatient deleted successfully.' });
    } catch (error) { this.notifyUpdate.alertNotify.next({ type: 'error', msg: error instanceof Error ? error.message : 'Inpatient could not be deleted. Please try again.' }); }
    finally { this.deletingId = null; }
  }
}
