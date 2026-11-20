import { sameClinicalName } from 'src/app/Services/clinical-catalog.service';
import { EventEmitter, Output } from '@angular/core';
import { ScrollPagination, trackRecord } from 'src/app/Shared/scroll-pagination';
import { includesText, matchesDateFilter } from 'src/app/Shared/list-filters';
import { firstValueFrom, Subscription } from 'rxjs';
import { RecordDetailsComponent } from 'src/app/Components/record-details/record-details.component';
import { exportRecords } from 'src/app/Shared/export-records';
import { ChangeDetectorRef, Component, OnInit , OnDestroy } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { OpdEditComponent } from '../opd-edit/opd-edit.component';
import { OpdService } from 'src/app/Services/opd.service';
import { OpdDataService } from 'src/app/Services/opd-data.service';
import { Opd } from 'src/app/Models/opd.model';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';
import { UserLoginService } from 'src/app/Services/user-login.service';
import { ProcedureOption, ProcedureService } from 'src/app/Services/procedure.service';
import { OpdSlipComponent } from '../opd-slip/opd-slip.component';

@Component({
  selector: 'app-opd-list',
  templateUrl: './opd-list.component.html',
  styleUrls: ['./opd-list.component.css']
})
export class OpdListComponent implements OnInit, OnDestroy {
  @Output() create = new EventEmitter<void>();

  readonly pagination = new ScrollPagination();
  readonly trackRecord = trackRecord;
  private loadVersion = 0;
  loading = false;
  loadFailed = false;
  deletingId: number | null = null;
  loadMore(): void { this.pagination.loadMore(this.total); this.updateDisplayedOpds(); }

  private refreshSubscription?: Subscription;
  private procedureSubscription?: Subscription;
  private procedureVersion = 0;
  procedureOptions: ProcedureOption[] = [];
  proceduresLoading = false;
  proceduresFailed = false;
  ngOnDestroy(): void { this.refreshSubscription?.unsubscribe(); this.procedureSubscription?.unsubscribe(); this.loadVersion++; this.procedureVersion++; }
  async viewOpd(id: number): Promise<void> {
    try {
      const record = await firstValueFrom(this.opdService.getOpdDetails(id));
      if (!record) throw new Error('Record not found.');
      this.dialog.open(RecordDetailsComponent, { data: { title: 'OPD visit', record } });
    } catch (error) { this.notifyUpdate.alertNotify.next({ type: 'error', msg: error instanceof Error ? error.message : 'Unable to load record.' }); }
  }


  opd: Opd[] = [];
  filteredOpds: Opd[] = [];
  displayedOpds: Opd[] = [];
  dataSource: OpdDataService = new OpdDataService(this.opdService);
  displayedColumns: string[] = [];
  tempOpd!: Opd;
  // 🔍 Search fields
  searchPatientId: string = '';
  searchName: string = '';
  searchDrName = '';
  get savedDoctorValues(): string[] { return [...new Set(this.opd.map(record => record.drName).filter(Boolean))]; }
  searchPhone: string = '';
  searchCity: string = '';
  searchProcedure: string = '';
  dateFilter: string = 'all';
  total: number = 0;
  isSuperAdmin: boolean = false;

  constructor(
    private opdService: OpdService,
    private dialog: MatDialog,
    private intl: MatPaginatorIntl,
    private changeDetectorRef: ChangeDetectorRef,
    private notifyUpdate: NotifyUpdateService,
    private indexDb: SupabaseDataService,
    private userLogin: UserLoginService,
    private procedures: ProcedureService = new ProcedureService(indexDb)
  ) {
    this.refreshSubscription = this.notifyUpdate.notify.subscribe(() => {
      this.dataActions('', 'asc', 0, 5);
    });
  }

  async ngOnInit(): Promise<void> {
    void this.loadProcedures();
    this.procedureSubscription = this.indexDb.changes.subscribe(collection => { if (collection === 'procedures') void this.loadProcedures(); });
    this.userLogin.getLoginUser().then((loginUser) => {
      this.isSuperAdmin = loginUser === 'admin';
      this.displayedColumns = ['patientId', 'patientName', 'dateTime', 'sex', 'drName', 'procedure', 'followUp', 'createdAt'];
      this.displayedColumns.push('action');
      this.dataActions('', 'asc', 0, 5);
    }).catch(() => { this.loading = false; this.loadFailed = true; this.notifyUpdate.alertNotify.next({ type: 'error', msg: 'Account permissions could not be loaded. Please refresh the page.' }); });
  }
  private updateDisplayedOpds(): void {
    this.total = this.filteredOpds.length;
    this.displayedOpds = this.pagination.slice(this.filteredOpds);
    this.dataSource.updatePatients(this.displayedOpds);
  }

  dataActions(_filter: string, _sort: string, _page: number, _size: number): void {
    const version = ++this.loadVersion;
    this.loading = true; this.loadFailed = false;
    this.opdService.getAllOpds().subscribe({
      next: records => { if (version !== this.loadVersion) return; this.opd = records; this.onDateFilter(false); this.loading = false; },
      error: error => { if (version === this.loadVersion) { this.loading = false; this.loadFailed = true; this.notifyUpdate.alertNotify.next({ type: 'error', msg: error instanceof Error ? error.message : 'Unable to load records.' }); } }
    });
  }

  onDateFilter(reset = true): void {
    this.filteredOpds = this.opd.filter(record => matchesDateFilter(record.createdAt, this.dateFilter) && includesText(record.patientId, this.searchPatientId) && includesText(record.patientName, this.searchName) && includesText(record.phone, this.searchPhone) && (!this.searchDrName || sameClinicalName(record.drName, this.searchDrName)) && includesText(record.address, this.searchCity) && (!this.searchProcedure || this.sameProcedure(record.procedure || '', this.searchProcedure)));
    if (reset) this.pagination.reset();
    this.updateDisplayedOpds();
  }

  onSearch(): void { this.onDateFilter(); }

  readonly sameProcedure = (left: string, right: string): boolean => this.procedureKey(left) === this.procedureKey(right);
  private procedureKey(value: string): string { return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase(); }
  get procedureFilterOptions(): string[] {
    const names = new Map<string, string>();
    for (const name of [...this.procedureOptions.map(option => option.name), ...this.opd.map(patient => patient.procedure || ''), this.searchProcedure]) {
      const key = this.procedureKey(name);
      if (key && !names.has(key)) names.set(key, String(name).trim());
    }
    return Array.from(names.values()).sort((a, b) => a.localeCompare(b));
  }
  async loadProcedures(): Promise<void> {
    const version = ++this.procedureVersion;
    this.proceduresLoading = true; this.proceduresFailed = false;
    try {
      const options = await this.procedures.getAll();
      if (version === this.procedureVersion) this.procedureOptions = options;
    } catch {
      if (version === this.procedureVersion) { this.proceduresFailed = true; this.notifyUpdate.error('Unable to load the procedure filter. Use Retry to refresh it.'); }
    } finally { if (version === this.procedureVersion) this.proceduresLoading = false; }
  }

  onClearSearch(): void { this.searchPatientId = ''; this.searchName = ''; this.searchDrName = ''; this.searchPhone = ''; this.searchCity = ''; this.searchProcedure = ''; this.dateFilter = 'all'; this.onDateFilter(); }

  exportToExcel(): void { exportRecords(this.filteredOpds, 'opd-visits.xlsx', 'Records', this.notifyUpdate); }


  // ✏️ Edit
  editOpd(id: number): void {
    this.opdService.getOpdDetails(id).subscribe({ next: (data: Opd) => {
      if (data) {
        this.tempOpd = data;
        const dialogData = { ...data, oldPatientId: data.patientId } as any;
        const dialogConfig = new MatDialogConfig();
        dialogConfig.disableClose = true;
        dialogConfig.autoFocus = true;
        dialogConfig.data = dialogData;
        const dialogRef = this.dialog.open(OpdEditComponent, dialogConfig);

        dialogRef.afterClosed().subscribe(async (updatedOpd: any) => {
          if (updatedOpd) {
            const res = await this.opdService.updateOpd(updatedOpd);
            const msg = res ? "OPD visit updated successfully." : 'The record could not be updated. Please try again.';
            const type = res ? "success" : "error";
            this.notifyUpdate.notify.next(true);
            this.notifyUpdate.alertNotify.next({ msg, type });
          }
        });
      } else {
        this.notifyUpdate.alertNotify.next({ msg: "OPD not found", type: "error" });
      }
    }, error: () => this.notifyUpdate.alertNotify.next({ type: 'error', msg: 'OPD visit details could not be loaded. Refresh the list and try again.' }) });
  }

  // 🗑️ Delete
  async deleteOpd(id: number): Promise<void> {
    if (this.deletingId !== null || !window.confirm('Delete this opd visit? This action cannot be undone.')) return;
    this.deletingId = id;
    try {
      const saved = await this.opdService.deleteOpd(id);
      if (!saved) throw new Error('OPD visit could not be deleted. Refresh the list and try again.');
      this.notifyUpdate.notify.next(true);
      this.notifyUpdate.alertNotify.next({ type: 'success', msg: 'OPD visit deleted successfully.' });
    } catch (error) { this.notifyUpdate.alertNotify.next({ type: 'error', msg: error instanceof Error ? error.message : 'OPD visit could not be deleted. Please try again.' }); }
    finally { this.deletingId = null; }
  }


  async printSlip(opd: Opd): Promise<void> {
    try {
      const record = await firstValueFrom(this.opdService.getOpdDetails(opd.patientId));
      if (!record) throw new Error('OPD record not found.');
      this.openThermalPreview([record]);
    } catch (error) { this.notifyUpdate.alertNotify.next({ type: 'error', msg: error instanceof Error ? error.message : 'Unable to load the OPD slip.' }); }
  }

  printAllSlips(): void {
    if (!this.filteredOpds.length) {
      this.notifyUpdate.alertNotify.next({ type: 'error', msg: 'No matching OPD records to print.' });
      return;
    }
    this.openThermalPreview(this.filteredOpds);
  }

  private openThermalPreview(opds: readonly Opd[]): void {
    this.dialog.open(OpdSlipComponent, { data: { opds: opds.map(opd => ({ ...opd })) }, width: '480px', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' });
  }
}
