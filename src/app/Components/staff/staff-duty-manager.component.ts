import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { STAFF_COLLECTION } from '../../Services/staff.service';
import { STAFF_DUTY_CATALOG, StaffDutyCatalogService, StaffDutyOption } from '../../Services/staff-duty-catalog.service';
import { NotifyUpdateService } from '../../Services/notify-update.service';
import { requiredText } from '../../Services/validators.service';
import { staffKey } from '../../Models/staff.model';
import { ScrollPagination, trackRecord } from '../../Shared/scroll-pagination';

@Component({ selector: 'app-staff-duty-manager', templateUrl: './staff-duty-manager.component.html', styleUrls: ['./staff-duty-manager.component.css'] })
export class StaffDutyManagerComponent implements OnInit, OnDestroy {
  readonly name = new FormControl('', { nonNullable: true, validators: [requiredText, Validators.maxLength(120)] });
  readonly pagination = new ScrollPagination(); readonly trackRecord = trackRecord;
  options: StaffDutyOption[] = []; query = ''; status = 'active'; editingId = ''; saving = false; deletingId = ''; loading = false; loadFailed = false; error = '';
  private changes?: Subscription; private version = 0;
  constructor(private duties: StaffDutyCatalogService, private feedback: NotifyUpdateService) {}
  ngOnInit(): void { void this.load(); this.changes = this.duties.changes.subscribe(collection => { if (collection === STAFF_DUTY_CATALOG || collection === STAFF_COLLECTION) void this.load(); }); }
  ngOnDestroy(): void { this.version++; this.changes?.unsubscribe(); }
  get filtered(): StaffDutyOption[] { const query = staffKey(this.query); return this.options.filter(option => (this.status === 'all' || option.active === (this.status === 'active')) && (!query || staffKey(option.name).includes(query))); }
  get visible(): StaffDutyOption[] { return this.pagination.slice(this.filtered); }
  onSearch(): void { this.pagination.reset(); }
  loadMore(): void { this.pagination.loadMore(this.filtered.length); }
  async load(): Promise<void> {
    const version = ++this.version; this.loading = true;
    try { const options = await this.duties.getAll(true); if (version === this.version) { this.options = options; this.loadFailed = false; this.error = ''; } }
    catch (error) { if (version === this.version) { this.loadFailed = true; this.fail(error, 'Unable to load duties.'); } }
    finally { if (version === this.version) this.loading = false; }
  }
  edit(option: StaffDutyOption): void { if (!this.saving) { this.editingId = option.id; this.name.setValue(option.name); this.name.markAsUntouched(); } }
  cancel(): void { if (!this.saving) { this.editingId = ''; this.name.reset(''); } }
  async save(): Promise<void> {
    if (this.saving || this.loading || this.loadFailed) return;
    if (this.name.invalid) { this.name.markAsTouched(); this.feedback.warning('Enter a valid duty name.'); return; }
    this.saving = true; this.error = ''; const editing = !!this.editingId;
    try {
      const previous = this.options.find(option => option.id === this.editingId);
      const saved = await this.duties.save(this.name.value, this.editingId || undefined, previous?.active !== false);
      this.editingId = ''; this.name.reset(''); this.query = ''; this.status = saved.active ? 'active' : 'inactive'; this.onSearch();
      this.feedback.success(editing ? 'Duty updated successfully.' : 'Duty added successfully.', { route: '/staff' }); await this.load();
    } catch (error) { this.fail(error, 'Unable to save the duty.'); } finally { this.saving = false; }
  }
  async toggle(option: StaffDutyOption): Promise<void> {
    if (this.saving || this.loading || this.loadFailed || !window.confirm((option.active ? 'Remove ' : 'Restore ') + option.name + '? ' + (option.active ? 'Existing staff assignments and duty timings will be kept.' : 'It will be available for new staff assignments.'))) return;
    this.saving = true; this.deletingId = option.id;
    try {
      await this.duties.setActive(option.id, !option.active);
      if (this.editingId === option.id) { this.editingId = ''; this.name.reset(''); }
      this.feedback.success(option.active ? 'Duty deleted successfully.' : 'Duty restored successfully.', { route: '/staff' }); await this.load();
    } catch (error) { this.fail(error, 'Unable to update the duty.'); } finally { this.saving = false; this.deletingId = ''; }
  }
  private fail(error: unknown, fallback: string): void { this.error = error instanceof Error ? error.message : fallback; this.feedback.error(this.error); }
}
