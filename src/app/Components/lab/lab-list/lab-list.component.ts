import { labTestNames, sameClinicalName } from 'src/app/Services/clinical-catalog.service';
import { EventEmitter, Output } from '@angular/core';
import { ScrollPagination, trackRecord } from 'src/app/Shared/scroll-pagination';
import { includesText, matchesDateFilter } from 'src/app/Shared/list-filters';
import { firstValueFrom, Subscription } from 'rxjs';
import { RecordDetailsComponent } from 'src/app/Components/record-details/record-details.component';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewContainerRef } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { PatientDetail } from 'src/app/Models/patientDetail.model';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { LabEditComponent } from '../lab-edit/lab-edit.component';
import { LabPatientDataService } from 'src/app/Services/lab-data.service';
import { LabService } from 'src/app/Services/lab.service';
import { LabPatient } from 'src/app/Models/lab.model';
import { UserLoginService } from 'src/app/Services/user-login.service';
import { formatTime12 } from 'src/app/Pipes/time-format.pipe';
import { LabSlipPreviewComponent } from '../lab-slip-preview.component';
import { exportRecords } from 'src/app/Shared/export-records';

@Component({
  selector: 'app-lab-list',
  templateUrl: './lab-list.component.html',
  styleUrls: ['./lab-list.component.css']
})
export class LabListComponent implements OnInit, OnDestroy {
  @Output() create = new EventEmitter<void>();

  readonly pagination = new ScrollPagination();
  readonly trackRecord = trackRecord;
  private loadVersion = 0;
  loading = false;
  loadFailed = false;
  deletingId: string | null = null;
  searchQuery = '';
  searchDoctorName = '';
  searchTestName = '';
  get savedDoctorValues(): string[] { return [...new Set(this.patient.map(record => record.suggestedDr).filter(Boolean))]; }
  get savedTestValues(): string[] { return [...new Set(this.patient.flatMap(record => labTestNames(record.testName)))]; }
  filteredPatients: LabPatient[] = [];
  loadMore(): void { this.pagination.loadMore(this.total); this.updateDisplayedPatients(); }

  onDateFilter(reset = true): void {
    this.filteredPatients = this.patient.filter(record => includesText([record.mrNumber ?? record.patientId,record.name,record.phone,record.testName,record.suggestedDr].join(' '), this.searchQuery) && (!this.searchDoctorName || sameClinicalName(record.suggestedDr, this.searchDoctorName)) && (!this.searchTestName || labTestNames(record.testName).some(name => sameClinicalName(name, this.searchTestName))));
    if (reset) this.pagination.reset();
    this.updateDisplayedPatients();
  }
  onSearch(): void { this.onDateFilter(); }
  labKey(lab: LabPatient): string { return String(lab.labId || lab.patientId || ''); }
  onClearSearch(): void { this.searchQuery = ''; this.searchDoctorName = ''; this.searchTestName = ''; this.onSearch(); }

  private refreshSubscription?: Subscription;
  ngOnDestroy(): void { this.refreshSubscription?.unsubscribe(); this.loadVersion++; }
  async viewLab(id: number | string): Promise<void> {
    try {
      const record = await firstValueFrom(this.labService.getLabPatientDetails(id));
      if (!record) throw new Error('Record not found.');
      this.dialog.open(RecordDetailsComponent, { data: { title: 'Lab test', record } });
    } catch (error) { this.notifyUpdate.alertNotify.next({ type: 'error', msg: error instanceof Error ? error.message : 'Unable to load record.' }); }
  }

  exportToExcel(): void { exportRecords(this.filteredPatients, 'lab-tests.xlsx', 'Lab tests', this.notifyUpdate); }

  patient: LabPatient[] = [];
  displayedPatients: LabPatient[] = [];
  dataSource: LabPatientDataService = new LabPatientDataService(this.labService);
  displayedColumns: string[] = [];


  tempLabPatient: LabPatient = {
    patientId: 0,
    price: 0,
    suggestedDr: '',
    dateTime: '',
    name: '',
    phone: '',
    testName: '',
  };

  total: number = 0;
  isSuperAdmin: boolean = false;

  constructor(private labService: LabService, private dialog: MatDialog,
    private intl: MatPaginatorIntl, private changeDetectorRef: ChangeDetectorRef,
    private userLogin: UserLoginService,
    private notifyUpdate: NotifyUpdateService) {

    this.refreshSubscription = this.notifyUpdate.notify.subscribe(() => {
      this.dataActions('', 'asc', 0, 5);
    });
  }

ngOnInit(): void {
    this.loading = true;
  this.userLogin.getLoginUser().then((loginUser) => {
    this.isSuperAdmin = loginUser === 'admin';

    this.displayedColumns = ['patientId', 'name', 'testName', 'price', 'suggestedDr', 'dateTime'];

    this.displayedColumns.push('action');

    // Now safe to call data
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
    this.labService.getAllLabPatient().subscribe({
      next: records => { if (version !== this.loadVersion) return; this.patient = records; this.onDateFilter(false); this.loading = false; },
      error: error => { if (version === this.loadVersion) { this.loading = false; this.loadFailed = true; this.notifyUpdate.alertNotify.next({ type: 'error', msg: error instanceof Error ? error.message : 'Unable to load records.' }); } }
    });
  }


 editLabPatient(id: number | string) {
  this.labService.getLabPatientDetails(id).subscribe({ next: data => {
    if (!data) { this.notifyUpdate.alertNotify.next({type: 'error', msg: 'This lab test is no longer available. Refresh the list.'}); return; }
    this.tempLabPatient = data;

    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.data = {...data};

    const dialogRef = this.dialog.open(LabEditComponent, dialogConfig);

    dialogRef.afterClosed().subscribe(async (data: LabPatient) => {
      if (data) {

        let success: boolean;
        try { success = await this.labService.updateLabPatient(data); }
        catch (error) { this.notifyUpdate.error(error instanceof Error ? error.message : 'Unable to update lab test.'); return; }
        const msg = success ? "Lab test updated successfully." : 'The record could not be updated. Please try again.';
        const type = success ? "success" : "error";
        if (success) {
          this.notifyUpdate.notify.next(true);
        }
        this.notifyUpdate.alertNotify.next({ msg, type });
      }
    });
  }, error: () => this.notifyUpdate.alertNotify.next({ type: 'error', msg: 'Lab test details could not be loaded. Refresh the list and try again.' }) });
}

  async deleteLabPatient(id: number | string): Promise<void> {
    if (this.deletingId !== null || !window.confirm('Delete this lab test? This action cannot be undone.')) return;
    this.deletingId = String(id);
    try {
      const saved = await this.labService.deleteLabPatient(id);
      if (!saved) throw new Error('Lab test could not be deleted. Refresh the list and try again.');
      this.notifyUpdate.notify.next(true);
      this.notifyUpdate.alertNotify.next({ type: 'success', msg: 'Lab test deleted successfully.' });
    } catch (error) { this.notifyUpdate.alertNotify.next({ type: 'error', msg: error instanceof Error ? error.message : 'Lab test could not be deleted. Please try again.' }); }
    finally { this.deletingId = null; }
  }

  async printLabSlip(patientId: number | string): Promise<void> {
    try {
      const record = await firstValueFrom(this.labService.getLabPatientDetails(patientId));
      if (!record) throw new Error('Lab data not found for printing. Refresh the list and try again.');
      this.dialog.open(LabSlipPreviewComponent, { data: { record: { ...record } }, width: '480px', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' });
    } catch (error) {
      this.notifyUpdate.error(error instanceof Error ? error.message : 'Unable to load the laboratory slip.');
    }
  }
}
