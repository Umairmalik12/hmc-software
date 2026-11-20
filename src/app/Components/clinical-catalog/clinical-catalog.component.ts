import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ClinicalCatalogKind, ClinicalCatalogService, ClinicalOption, CLINICAL_COLLECTIONS } from '../../Services/clinical-catalog.service';
import { NotifyUpdateService } from '../../Services/notify-update.service';
import { requiredText } from '../../Services/validators.service';
import { ScrollPagination, trackRecord } from '../../Shared/scroll-pagination';
import { exportRecords } from '../../Shared/export-records';

@Component({
  selector: 'app-clinical-catalog', templateUrl: './clinical-catalog.component.html', styleUrls: ['./clinical-catalog.component.css'],
})
export class ClinicalCatalogComponent implements OnInit, OnDestroy {
  @Input() kind: ClinicalCatalogKind = 'doctors';
  readonly pagination = new ScrollPagination();
  readonly trackRecord = trackRecord;
  readonly name = new FormControl('', { nonNullable: true, validators: [Validators.required, requiredText, Validators.maxLength(120)] });
  options: ClinicalOption[] = [];
  query = '';
  status = 'active';
  active = true;
  editingId = '';
  loading = false;
  saving = false;
  deletingId = '';
  error = '';
  loadFailed = false;
  private changes?: Subscription;
  private version = 0;
  get title(): string { return this.kind === 'doctors' ? 'Doctors & surgeons' : 'Lab test catalogue'; }
  get singular(): string { return this.kind === 'doctors' ? 'Doctor / surgeon' : 'Lab test'; }
  get route(): string { return this.kind === 'doctors' ? '/doctors' : '/lab-tests'; }
  get filtered(): ClinicalOption[] { return this.options.filter(option => (this.status === 'all' || option.active === (this.status === 'active')) && option.name.toLocaleLowerCase().includes(this.query.trim().toLocaleLowerCase())); }
  get visibleOptions(): ClinicalOption[] { return this.pagination.slice(this.filtered); }
  constructor(private catalog: ClinicalCatalogService, private feedback: NotifyUpdateService) {}
  ngOnInit(): void { void this.load(); this.changes = this.catalog.changes.subscribe(collection => { if (collection === CLINICAL_COLLECTIONS[this.kind]) void this.load(); }); }
  ngOnDestroy(): void { this.changes?.unsubscribe(); this.version++; }
  onSearch(): void { this.pagination.reset(); }
  loadMore(): void { this.pagination.loadMore(this.filtered.length); }
  async load(): Promise<void> {
    const version = ++this.version; this.loading = true; this.loadFailed = false;
    try { const options = await this.catalog.getAll(this.kind, true); if (version === this.version) { this.options = options; this.error = ''; } }
    catch (error) { if (version === this.version) { this.loadFailed = true; this.fail(error, 'Unable to load the catalogue.'); } }
    finally { if (version === this.version) this.loading = false; }
  }
  edit(option: ClinicalOption): void { this.editingId = option.id; this.name.setValue(option.name); this.active = option.active; }
  cancel(): void { this.editingId = ''; this.name.reset(''); this.active = true; this.error = ''; }
  async save(): Promise<void> {
    if (this.saving || this.loading || this.loadFailed) return;
    if (this.name.invalid) { this.name.markAsTouched(); this.feedback.warning('Enter a ' + this.singular.toLocaleLowerCase() + ' name before saving.'); return; }
    this.saving = true;
    try {
      const updating = !!this.editingId;
      await this.catalog.save(this.kind, this.name.value, this.editingId || undefined, this.active);
      this.cancel(); this.onSearch(); this.feedback.success(this.singular + (updating ? ' updated successfully.' : ' added successfully.'), { route: this.route });
      await this.load();
    } catch (error) { this.fail(error, 'Unable to save the catalogue record.'); }
    finally { this.saving = false; }
  }
  async delete(option: ClinicalOption): Promise<void> {
    if (this.saving || this.loading || this.loadFailed || !window.confirm('Remove ' + option.name + ' from future selections? Saved patient records will keep their original details.')) return;
    this.saving = true; this.deletingId = option.id;
    try {
      await this.catalog.delete(this.kind, option); if (this.editingId === option.id) this.cancel();
      this.feedback.success(this.singular + ' deleted successfully.', { route: this.route }); await this.load();
    } catch (error) { this.fail(error, 'Unable to delete the catalogue record.'); }
    finally { this.saving = false; this.deletingId = ''; }
  }
  export(): void { exportRecords(this.filtered.map(option => ({ Name: option.name, Status: option.active ? 'Active' : 'Inactive' })), this.kind + '.xlsx', this.title, this.feedback); }
  private fail(error: unknown, fallback: string): void { this.error = error instanceof Error ? error.message : fallback; this.feedback.error(this.error); }
}
