import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { StaffRecord, STAFF_SHIFTS, employmentLabel, formatDutyTiming, staffKey, uniqueStaffValues } from '../../Models/staff.model';
import { StaffService, STAFF_COLLECTION } from '../../Services/staff.service';
import { NotifyUpdateService } from '../../Services/notify-update.service';
import { ScrollPagination, trackRecord } from '../../Shared/scroll-pagination';
import { exportRecords } from '../../Shared/export-records';
import { RecordDetailsComponent } from '../record-details/record-details.component';
import { StaffEditComponent } from './staff-edit.component';
import { STAFF_DUTY_CATALOG, StaffDutyCatalogService, StaffDutyOption } from '../../Services/staff-duty-catalog.service';
import { StaffDutyManagerComponent } from './staff-duty-manager.component';

@Component({ selector: 'app-staff-list', templateUrl: './staff-list.component.html', styleUrls: ['./staff-list.component.css'] })
export class StaffListComponent implements OnInit, OnDestroy {
  @Input() isSuperAdmin = false;
  readonly pagination = new ScrollPagination();
  readonly trackRecord = trackRecord;
  readonly timing = formatDutyTiming;
  readonly employment = employmentLabel;
  records: StaffRecord[] = [];
  duties: StaffDutyOption[] = [];
  dutiesLoading = false;
  dutiesError = '';
  private dutiesVersion = 0;
  query = '';
  dutyFilter = '';
  shiftFilter = '';
  typeFilter = '';
  statusFilter = 'active';
  loading = false;
  loadFailed = false;
  error = '';
  deletingId = '';
  private changes?: Subscription;
  private version = 0;
  private destroyed = false;
  constructor(private staff: StaffService, private dialog: MatDialog, private feedback: NotifyUpdateService, private dutyCatalog: StaffDutyCatalogService) {}
  ngOnInit(): void { void this.load(); void this.loadDuties(); this.changes = this.staff.changes.subscribe(collection => { if (collection === STAFF_COLLECTION) { void this.load(); void this.loadDuties(); } else if (collection === STAFF_DUTY_CATALOG) void this.loadDuties(); }); }
  ngOnDestroy(): void { this.destroyed = true; this.version++; this.dutiesVersion++; this.changes?.unsubscribe(); }
  get dutyOptions(): string[] { return uniqueStaffValues([...this.duties.map(option => option.name), ...this.records.flatMap(record => record.assignments.map(assignment => assignment.duty))]); }
  async loadDuties(): Promise<void> {
    const version = ++this.dutiesVersion; this.dutiesLoading = true;
    try { const duties = await this.dutyCatalog.getAll(); if (version === this.dutiesVersion) { this.duties = duties; this.dutiesError = ''; } }
    catch { if (version === this.dutiesVersion) this.dutiesError = 'Unable to load duties. Retry to refresh.'; }
    finally { if (version === this.dutiesVersion) this.dutiesLoading = false; }
  }
  manageDuties(): void { this.dialog.open(StaffDutyManagerComponent, { width: 'min(820px, calc(100vw - 32px))', maxWidth: '94vw', maxHeight: '92vh', disableClose: true, panelClass: 'hmc-dialog-panel' }); }
  get shiftOptions(): string[] { return uniqueStaffValues([...STAFF_SHIFTS, ...this.records.flatMap(record => record.assignments.map(assignment => assignment.shift))]); }
  get filtered(): StaffRecord[] {
    const query = staffKey(this.query);
    return this.records.filter(record => (this.statusFilter === 'all' || record.active === (this.statusFilter === 'active'))
      && (!this.typeFilter || (this.typeFilter === 'unrecorded' ? !record.employmentType : record.employmentType === this.typeFilter))
      && (!(this.dutyFilter || this.shiftFilter) || record.assignments.some(assignment => (!this.dutyFilter || staffKey(assignment.duty) === staffKey(this.dutyFilter)) && (!this.shiftFilter || staffKey(assignment.shift) === staffKey(this.shiftFilter))))
      && (!query || staffKey([record.id, record.name, record.designation, this.employment(record.employmentType),
        ...record.assignments.flatMap(assignment => [assignment.duty, assignment.shift, assignment.startTime, assignment.endTime, this.timing(assignment)])].join(' ')).includes(query)));
  }
  get visibleRecords(): StaffRecord[] { return this.pagination.slice(this.filtered); }
  onSearch(): void { this.pagination.reset(); }
  clearFilters(): void { this.query = ''; this.dutyFilter = ''; this.shiftFilter = ''; this.typeFilter = ''; this.statusFilter = 'active'; this.onSearch(); }
  loadMore(): void { this.pagination.loadMore(this.filtered.length); }
  async load(): Promise<void> {
    const version = ++this.version; this.loading = true; this.loadFailed = false;
    try { const records = await this.staff.getAll(true); if (version === this.version) { this.records = records; this.error = ''; } }
    catch (error) { if (version === this.version) { this.loadFailed = true; this.fail(error, 'Unable to load staff records.'); } }
    finally { if (version === this.version) this.loading = false; }
  }
  async edit(record?: StaffRecord): Promise<void> {
    if (this.deletingId || this.loading || this.loadFailed) return;
    try {
      const current = record ? await this.staff.getById(record.id) : undefined;
      if (record && !current) throw new Error('This staff record no longer exists. Refresh the list.');
      if (this.destroyed) return;
      const ref = this.dialog.open(StaffEditComponent, { data: { record: current,
        designations: uniqueStaffValues(this.records.map(item => item.designation)), shifts: this.shiftOptions },
        disableClose: true, width: 'min(820px, calc(100vw - 32px))', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' });
      ref.afterClosed().subscribe((saved?: StaffRecord) => { if (saved && !this.destroyed) { this.onSearch(); void this.load(); } });
    } catch (error) { this.fail(error, 'Unable to open the staff record.'); }
  }
  view(record: StaffRecord): void {
    this.dialog.open(RecordDetailsComponent, { data: { title: 'Staff member', record: {
      staffId: record.id, name: record.name, designation: record.designation, employmentType: this.employment(record.employmentType),
      status: record.active ? 'Active' : 'Inactive', duties: record.assignments.map(assignment => ({ duty: assignment.duty, shift: assignment.shift, timing: this.timing(assignment) })),
      createdAt: record.createdAt, updatedAt: record.updatedAt,
    } } });
  }
  async delete(record: StaffRecord): Promise<void> {
    if (this.deletingId || this.loading || !window.confirm('Deactivate ' + record.name + '? Their duty details and saved payment history will be preserved.')) return;
    this.deletingId = record.id;
    try { await this.staff.delete(record.id); this.feedback.success('Staff deactivated successfully.', { route: '/staff' }); await this.load(); }
    catch (error) { this.fail(error, 'Unable to deactivate the staff member.'); }
    finally { this.deletingId = ''; }
  }
  export(): void {
    exportRecords(this.filtered.map(record => ({ 'Staff ID': record.id, Name: record.name, Designation: record.designation,
      Employment: this.employment(record.employmentType), Status: record.active ? 'Active' : 'Inactive',
      Duties: record.assignments.map(assignment => assignment.duty + (assignment.shift ? ' | ' + assignment.shift : '') + ' | ' + this.timing(assignment)).join('\n'),
      'Registered on': record.createdAt, 'Last updated': record.updatedAt })), 'staff-duty-roster.xlsx', 'Staff', this.feedback);
  }
  private fail(error: unknown, fallback: string): void { this.error = error instanceof Error ? error.message : fallback; this.feedback.error(this.error); }
}
